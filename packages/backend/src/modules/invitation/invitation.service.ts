import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@common/prisma/prisma.service';
import { PermissionCacheService } from '@common/services/permission-cache.service';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { ActorContext, RbacService } from '../rbac/rbac.service';
import { AcceptInvitationDto, CreateInvitationDto, ListInvitationsQueryDto } from './dto/invitation.dto';

const RATE_LIMIT_PER_HOUR = 3;

/** Yanitta HAM token asla yok; tokenHash da yok. */
const INVITATION_SELECT = {
  id: true,
  agencyId: true,
  clientId: true,
  storeId: true,
  email: true,
  roleId: true,
  invitedBy: true,
  status: true,
  expiresAt: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InvitationSelect;

@Injectable()
export class InvitationService {
  constructor(
    private prisma: PrismaService,
    private rbac: RbacService,
    private auth: AuthService,
    private mail: MailService,
    private permissionCache: PermissionCacheService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private ttlMs(): number {
    const days = parseInt(process.env.INVITATION_TTL_DAYS || '7', 10);
    return (Number.isFinite(days) && days > 0 ? days : 7) * 24 * 60 * 60 * 1000;
  }

  private inviteUrl(rawToken: string): string {
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    return `${base}/invite/${rawToken}`;
  }

  /**
   * Saatte en fazla 3 davet/resend (ayni e-posta, ayni ajans). Sayac AuditLog:
   * resend satir uretmiyor, o yuzden Invitation.createdAt tek basina yetmez.
   */
  private async assertRateLimit(email: string, agencyId: string) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const sent = await this.prisma.auditLog.count({
      where: {
        tenantId: agencyId,
        entityType: 'Invitation',
        entityDisplayName: email,
        action: { in: ['invitation.created', 'invitation.resent'] },
        createdAt: { gte: since },
      },
    });
    if (sent >= RATE_LIMIT_PER_HOUR) {
      throw new HttpException(`Rate limit: at most ${RATE_LIMIT_PER_HOUR} invitations per hour for ${email}`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  // try/catch YOK (P5 bulgusu): tx icinde yutulan audit hatasi mutasyonu sessizce geri alir.
  private audit(
    tx: Prisma.TransactionClient,
    action: string,
    inv: { id: string; agencyId: string; email: string },
    performedBy: string | null,
    ipAddress?: string,
    values: { oldValue?: unknown; newValue?: unknown } = {},
  ) {
    return tx.auditLog.create({
      data: {
        action,
        module: 'system',
        entityType: 'Invitation',
        entityId: inv.id,
        entityDisplayName: inv.email,
        userId: performedBy,
        tenantId: inv.agencyId,
        ipAddress: ipAddress || null,
        oldValue: values.oldValue ? JSON.parse(JSON.stringify(values.oldValue)) : undefined,
        newValue: values.newValue ? JSON.parse(JSON.stringify(values.newValue)) : undefined,
      },
    });
  }

  /**
   * TODO(P8): gercek mail saglayicisi takilinca KALDIR. ConsoleMailProvider asamasinda
   * davet linki yalniz sunucu konsoluna dusuyor; gelistirmede UI'dan kopyalanabilsin diye
   * production DISINDA yanita eklenir. Production'da ham token yanita ASLA girmez.
   */
  private withDevLink<T extends object>(row: T, rawToken: string): T & { devInviteUrl?: string } {
    if (process.env.NODE_ENV === 'production') return row;
    return { ...row, devInviteUrl: this.inviteUrl(rawToken) };
  }

  private async sendInviteMail(email: string, rawToken: string, agencyName: string, roleName: string) {
    await this.mail.enqueue({
      to: email,
      subject: `${agencyName} sizi KroptOS'a davet etti`,
      text: `${agencyName} ajansina "${roleName}" rolüyle davet edildiniz.\nDaveti kabul etmek icin: ${this.inviteUrl(rawToken)}\nBu baglanti ${Math.round(this.ttlMs() / 86400000)} gun gecerlidir.`,
    });
  }

  /** Bekleyen davet varsa yenisi olusturulmaz, mevcut yeniden gonderilir. */
  async create(dto: CreateInvitationDto, actor: ActorContext) {
    const email = dto.email.trim().toLowerCase();
    // escalation + super_admin yasagi + rol bu ajansin/sistemin: OLUSTURURKEN (kabulde degil)
    const role = await this.rbac.assertAssignableRole(dto.roleId, actor);

    const scope = { clientId: dto.clientId || null, storeId: dto.storeId || null };
    if (scope.clientId) {
      const client = await this.prisma.client.findFirst({ where: { id: scope.clientId, agencyId: actor.agencyId, deletedAt: null } });
      if (!client) throw new BadRequestException(`Client '${scope.clientId}' does not belong to the active agency`);
    }
    if (scope.storeId) {
      const store = await this.prisma.store.findFirst({ where: { id: scope.storeId, agencyId: actor.agencyId, deletedAt: null } });
      if (!store) throw new BadRequestException(`Store '${scope.storeId}' does not belong to the active agency`);
      if (scope.clientId && store.clientId !== scope.clientId) {
        throw new BadRequestException(`Store '${scope.storeId}' does not belong to client '${scope.clientId}'`);
      }
    }

    const pending = await this.prisma.invitation.findFirst({
      where: { agencyId: actor.agencyId, email, status: 'pending', expiresAt: { gt: new Date() } },
      select: INVITATION_SELECT,
    });
    if (pending) {
      return this.resend(pending.id, actor);
    }

    await this.assertRateLimit(email, actor.agencyId);
    const agency = await this.prisma.agency.findFirst({ where: { id: actor.agencyId, deletedAt: null }, select: { name: true } });
    if (!agency) throw new NotFoundException('Agency not found');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invitation.create({
        data: {
          agencyId: actor.agencyId,
          email,
          roleId: role.id,
          ...scope,
          tokenHash: this.hashToken(rawToken),
          invitedBy: actor.userId,
          expiresAt: new Date(Date.now() + this.ttlMs()),
        },
        select: INVITATION_SELECT,
      });
      await this.audit(tx, 'invitation.created', inv, actor.userId, actor.ipAddress, {
        newValue: { roleKey: role.key, ...scope, expiresAt: inv.expiresAt },
      });
      return inv;
    });

    await this.sendInviteMail(email, rawToken, agency.name, role.name);
    return this.withDevLink(invitation, rawToken);
  }

  async list(query: ListInvitationsQueryDto, actor: ActorContext) {
    const where: Prisma.InvitationWhereInput = { agencyId: actor.agencyId, ...(query.status ? { status: query.status } : {}) };
    const [total, items] = await Promise.all([
      this.prisma.invitation.count({ where }),
      this.prisma.invitation.findMany({
        where,
        select: INVITATION_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    return { total, page: query.page, limit: query.limit, items };
  }

  private async findPendingInAgency(id: string, actor: ActorContext) {
    // Baska ajansin daveti 404: varligi sizmaz.
    const inv = await this.prisma.invitation.findFirst({ where: { id, agencyId: actor.agencyId }, select: INVITATION_SELECT });
    if (!inv) throw new NotFoundException('Invitation not found');
    if (inv.status !== 'pending') throw new BadRequestException(`Invitation is ${inv.status}`);
    return inv;
  }

  /** Yeni token uretir (eskisi gecersiz olur), sureyi uzatir, maili tekrar gonderir. */
  async resend(id: string, actor: ActorContext) {
    const inv = await this.findPendingInAgency(id, actor);
    await this.assertRateLimit(inv.email, actor.agencyId);
    const [agency, role] = await Promise.all([
      this.prisma.agency.findFirst({ where: { id: actor.agencyId }, select: { name: true } }),
      this.prisma.role.findFirst({ where: { id: inv.roleId, deletedAt: null }, select: { name: true } }),
    ]);
    if (!role) throw new BadRequestException('The invited role no longer exists; revoke and re-invite');

    const rawToken = crypto.randomBytes(32).toString('hex');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.invitation.update({
        where: { id: inv.id },
        data: { tokenHash: this.hashToken(rawToken), expiresAt: new Date(Date.now() + this.ttlMs()) },
        select: INVITATION_SELECT,
      });
      await this.audit(tx, 'invitation.resent', row, actor.userId, actor.ipAddress, { newValue: { expiresAt: row.expiresAt } });
      return row;
    });
    await this.sendInviteMail(inv.email, rawToken, agency?.name ?? 'KroptOS', role.name);
    return this.withDevLink(updated, rawToken);
  }

  async revoke(id: string, actor: ActorContext) {
    const inv = await this.findPendingInAgency(id, actor);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.invitation.update({ where: { id: inv.id }, data: { status: 'revoked' }, select: INVITATION_SELECT });
      await this.audit(tx, 'invitation.revoked', row, actor.userId, actor.ipAddress, { oldValue: { status: 'pending' }, newValue: { status: 'revoked' } });
      return row;
    });
  }

  // ---------------- public (token ile) ----------------

  /**
   * Token esitligi: DB'de hash ile arama + bellekte timingSafeEqual. Gecersiz /
   * kullanilmis / suresi gecmis davet ayni cevabi (410) verir; e-posta yalniz
   * gecerli davette doner.
   */
  private async findByRawToken(rawToken: string) {
    if (!/^[a-f0-9]{64}$/.test(rawToken)) throw new GoneException('Invitation is not valid');
    const hash = this.hashToken(rawToken);
    const inv = await this.prisma.invitation.findUnique({
      where: { tokenHash: hash },
      include: { agency: { select: { id: true, name: true, publicId: true } } },
    });
    if (!inv || !crypto.timingSafeEqual(Buffer.from(inv.tokenHash, 'hex'), Buffer.from(hash, 'hex'))) {
      throw new GoneException('Invitation is not valid');
    }
    if (inv.status !== 'pending' || inv.expiresAt.getTime() < Date.now()) {
      throw new GoneException('Invitation is not valid');
    }
    return inv;
  }

  async preview(rawToken: string) {
    const inv = await this.findByRawToken(rawToken);
    const [role, existing] = await Promise.all([
      this.prisma.role.findFirst({ where: { id: inv.roleId, deletedAt: null }, select: { key: true, name: true } }),
      this.prisma.user.findFirst({ where: { email: inv.email, deletedAt: null }, select: { id: true } }),
    ]);
    return {
      email: inv.email,
      agency: { name: inv.agency.name, publicId: inv.agency.publicId },
      role: role ? { key: role.key, name: role.name } : null,
      clientId: inv.clientId,
      storeId: inv.storeId,
      expiresAt: inv.expiresAt,
      // Sistemde varsa sifre sorulmaz, tek tikla kabul.
      userExists: Boolean(existing),
    };
  }

  /** Tek transaction. Basari: oturum token cifti + tenant listesi. */
  async accept(rawToken: string, dto: AcceptInvitationDto, ipAddress?: string) {
    const inv = await this.findByRawToken(rawToken);

    // Rol hala var ve silinmemis mi (davet olusturulurken yetki kontrolu yapildi; arada
    // gonderenin yetkisi degisse de davet gecerli, ama rol yoksa kabul edilemez).
    const role = await this.prisma.role.findFirst({
      where: { id: inv.roleId, deletedAt: null, OR: [{ agencyId: null }, { agencyId: inv.agencyId }] },
      select: { id: true, key: true, isSystem: true },
    });
    if (!role) throw new GoneException('The invited role no longer exists');
    if (role.key === 'super_admin' && role.isSystem) throw new GoneException('Invitation is not valid');

    const scope = { clientId: inv.clientId, storeId: inv.storeId };
    const existingUser = await this.prisma.user.findFirst({ where: { email: inv.email, deletedAt: null }, select: { id: true, isActive: true } });
    if (!existingUser && !dto.password) {
      throw new BadRequestException('password is required for a new account');
    }
    if (existingUser && !existingUser.isActive) {
      throw new BadRequestException('This account is deactivated');
    }

    const userId = await this.prisma.$transaction(async (tx) => {
      // Ayni token'la yaris: pending -> accepted gecisi tek satir etkilemeli.
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, status: 'pending' },
        data: { status: 'accepted', acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new GoneException('Invitation is not valid');

      let uid: string;
      if (existingUser) {
        uid = existingUser.id; // sifre gelse de yok sayilir
      } else {
        const created = await tx.user.create({
          data: {
            email: inv.email,
            passwordHash: await bcrypt.hash(dto.password!, 12),
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            isActive: true,
          },
          select: { id: true },
        });
        uid = created.id;
      }

      const active = await tx.userRole.findFirst({
        where: { userId: uid, agencyId: inv.agencyId, roleId: role.id, ...scope, deletedAt: null },
      });
      if (active) {
        // Davet accepted olarak kalir (yukarida isaretlendi), atama zaten var.
        throw new ConflictException('This role is already assigned for the invited scope');
      }
      const soft = await tx.userRole.findFirst({ where: { userId: uid, agencyId: inv.agencyId, roleId: role.id, ...scope } });
      if (soft) {
        await tx.userRole.update({ where: { id: soft.id }, data: { deletedAt: null } });
      } else {
        await tx.userRole.create({ data: { userId: uid, agencyId: inv.agencyId, roleId: role.id, ...scope } });
      }

      await this.audit(tx, 'invitation.accepted', inv, uid, ipAddress, {
        newValue: { userId: uid, roleKey: role.key, ...scope, newAccount: !existingUser },
      });
      return uid;
    }).catch(async (err) => {
      // 409: davet "accepted" kalmali ama tx geri sarildi -> isareti tx disinda yaz.
      if (err instanceof ConflictException) {
        await this.prisma.invitation.updateMany({ where: { id: inv.id, status: 'pending' }, data: { status: 'accepted', acceptedAt: new Date() } });
      }
      throw err;
    });

    await this.permissionCache.invalidateUser(userId);
    return this.auth.issueSessionFor(userId, { agencyId: inv.agencyId, ...scope }, ipAddress);
  }
}
