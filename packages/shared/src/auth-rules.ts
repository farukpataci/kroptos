/** Sifre kurali TEK kaynak: backend DTO'lari (RegisterDto, AcceptInvitationDto) ve frontend formlari buradan turetir. */
export const PASSWORD_MIN_LENGTH = 8;

export function passwordProblem(password: string): 'tooShort' | null {
  return password.length < PASSWORD_MIN_LENGTH ? 'tooShort' : null;
}
