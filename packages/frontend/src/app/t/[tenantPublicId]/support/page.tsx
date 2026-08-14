'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  TicketIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperClipIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { useToast } from '@/components/ui/Toast';

interface Message {
  senderName: string;
  senderEmail: string;
  avatar: string;
  role: 'customer' | 'agent';
  body: string;
  time: string;
  attachments?: string[];
}

interface Ticket {
  id: string;
  customerName: string;
  customerEmail: string;
  avatar: string;
  subject: string;
  createDate: string;
  category: string;
  status: 'Solved' | 'Pending' | 'In Progress' | 'On-Hold';
  messages: Message[];
}

const INITIAL_TICKETS: Ticket[] = [
  {
    id: '#323534',
    customerName: 'Lindsey Curtis',
    customerEmail: 'demoemail@gmail.com',
    avatar: 'LC',
    subject: 'Issue with Dashboard Login Access',
    createDate: '12 Feb, 2027',
    category: 'General Support',
    status: 'Solved',
    messages: [
      {
        senderName: 'Lindsey Curtis',
        senderEmail: 'demoemail@gmail.com',
        avatar: 'LC',
        role: 'customer',
        body: "Hi KroptOS Team,\nI can't log in to my dashboard from my home internet connection. It gives me a network timeout error, but works fine on mobile data. Can you check if my IP is blacklisted?",
        time: 'Mon, 3:20 PM (2 days ago)',
      },
      {
        senderName: 'Musharof Chowdhury',
        senderEmail: 'support@kroptos.com',
        avatar: 'MC',
        role: 'agent',
        body: 'Hello Lindsey,\nWe checked your firewall logs. Your IP was temporarily blocked due to multiple failed password attempts. We have whitelisted it now. Please try logging in again.',
        time: 'Mon, 4:10 PM (2 days ago)',
      },
    ],
  },
  {
    id: '#323535',
    customerName: 'Kaiya George',
    customerEmail: 'demoemail@gmail.com',
    avatar: 'KG',
    subject: 'Billing Information Not Updating Properly',
    createDate: '13 Mar, 2027',
    category: 'Billing & Subscriptions',
    status: 'Pending',
    messages: [
      {
        senderName: 'Kaiya George',
        senderEmail: 'demoemail@gmail.com',
        avatar: 'KG',
        role: 'customer',
        body: "I am trying to update our company credit card details but it keeps showing a 3D Secure verification error even though my bank says it's authorized. Please help.",
        time: 'Mon, 3:20 PM',
      },
    ],
  },
  {
    id: '#323536',
    customerName: 'Zain Geidt',
    customerEmail: 'demoemail@gmail.com',
    avatar: 'ZG',
    subject: 'Bug Found in Dark Mode Layout',
    createDate: '19 Mar, 2027',
    category: 'Technical Bug',
    status: 'Pending',
    messages: [
      {
        senderName: 'Zain Geidt',
        senderEmail: 'demoemail@gmail.com',
        avatar: 'ZG',
        role: 'customer',
        body: 'The order settings panel layout gets glitched in dark mode, some labels are black on dark gray background. Can you fix it?',
        time: 'Tue, 11:30 AM',
      },
    ],
  },
  {
    id: '#323537',
    customerName: 'Abram Schleifer',
    customerEmail: 'demoemail@gmail.com',
    avatar: 'AS',
    subject: 'Request to Add New Integration Feature',
    createDate: '25 Apr, 2027',
    category: 'Feature Request',
    status: 'Solved',
    messages: [
      {
        senderName: 'Abram Schleifer',
        senderEmail: 'demoemail@gmail.com',
        avatar: 'AS',
        role: 'customer',
        body: 'Could you please add support for direct Shopify order webhook synchronization?',
        time: 'Wed, 2:15 PM',
      },
    ],
  },
  {
    id: '#323538',
    customerName: 'Mia Chen',
    customerEmail: 'mia.chen@email.com',
    avatar: 'MC',
    subject: 'Unable to Reset Password',
    createDate: '28 Apr, 2027',
    category: 'Security Settings',
    status: 'Pending',
    messages: [
      {
        senderName: 'Mia Chen',
        senderEmail: 'mia.chen@email.com',
        avatar: 'MC',
        role: 'customer',
        body: 'The password reset link in the email leads to an expired token page immediately upon clicking.',
        time: 'Thu, 09:40 AM',
      },
    ],
  },
  {
    id: '#323539',
    customerName: 'John Doe',
    customerEmail: 'john.doe@email.com',
    avatar: 'JD',
    subject: 'Feature Request: Dark Mode',
    createDate: '30 Apr, 2027',
    category: 'Feature Request',
    status: 'Solved',
    messages: [
      {
        senderName: 'John Doe',
        senderEmail: 'john.doe@email.com',
        avatar: 'JD',
        role: 'customer',
        body: 'Dark mode looks great on the main dashboard! Thanks for implementing it.',
        time: 'Fri, 04:00 PM',
      },
    ],
  },
  {
    id: '#323540',
    customerName: 'Jane Smith',
    customerEmail: 'jane.smith@email.com',
    avatar: 'JS',
    subject: 'Error 500 on Dashboard',
    createDate: '01 May, 2027',
    category: 'Technical Bug',
    status: 'Pending',
    messages: [
      {
        senderName: 'Jane Smith',
        senderEmail: 'jane.smith@email.com',
        avatar: 'JS',
        role: 'customer',
        body: 'Getting intermittent 500 Server Error when loading the products analytics tab.',
        time: 'Sat, 10:12 AM',
      },
    ],
  },
  {
    id: '#346520',
    customerName: 'John Doe',
    customerEmail: 'jhondelin@gmail.com',
    avatar: 'JD',
    subject: 'Sidebar not responsive on mobile',
    createDate: 'Dec 20, 2028',
    category: 'General Support',
    status: 'In Progress',
    messages: [
      {
        senderName: 'John Doe',
        senderEmail: 'jhondelin@gmail.com',
        avatar: 'JD',
        role: 'customer',
        body: `Hi TailAdmin Team,\nI hope you're doing well.\n\nI'm currently working on customizing the TailAdmin dashboard and would like to add a new section labeled "Reports." Before I proceed, I wanted to check if there's any official guide or best practice you recommend for adding custom pages within the TailAdmin structure.`,
        time: 'Mon, 3:20 PM (2 hrs ago)',
      },
      {
        senderName: 'Musharof Chowdhury',
        senderEmail: 'From - tailadmin support team',
        avatar: 'MC',
        role: 'agent',
        body: `Hi John D,\n\nThanks for reaching out—and great to hear you're customizing TailAdmin to fit your needs! Yes, you can definitely add custom pages like a "Reports" section, and it's quite straightforward. Here's a quick guide to help you get started:`,
        time: 'Mon, 3:20 PM (2 hrs ago)',
      },
    ],
  },
];

export default function SupportTicketsPage() {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null); // Show list by default
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [activeDropdownTicketId, setActiveDropdownTicketId] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Solved' | 'Pending'>('All');

  // Reply Form & Attachments state
  const [replyText, setReplyText] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const newUrls = filesArray.map((file) => URL.createObjectURL(file));
    setAttachments((prev) => [...prev, ...newUrls]);
    e.target.value = '';
  };

  const handleRemoveAttachment = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const toast = useToast();
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveDropdownTicketId(null);
      setIsFilterDropdownOpen(false);
      setIsBulkDropdownOpen(false);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Selected Ticket calculations
  const selectedTicket = tickets.find((t) => t.id === selectedTicketId);

  // Filter & Search Table
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      activeFilter === 'All'
        ? true
        : activeFilter === 'Solved'
        ? t.status === 'Solved'
        : t.status === 'Pending' || t.status === 'In Progress' || t.status === 'On-Hold';

    const matchesCategory = selectedCategories.length === 0 ? true : selectedCategories.includes(t.category);

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleToggleSelectTicket = (id: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredTickets.map((t) => t.id);
    const allSelected = allFilteredIds.every((id) => selectedTicketIds.includes(id));
    if (allSelected) {
      setSelectedTicketIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)));
    } else {
      setSelectedTicketIds((prev) => {
        const newIds = [...prev];
        allFilteredIds.forEach((id) => {
          if (!newIds.includes(id)) newIds.push(id);
        });
        return newIds;
      });
    }
  };

  const handleBulkDeleteConfirm = () => {
    if (selectedTicketIds.length === 0) return;
    setTickets((prev) => prev.filter((t) => !selectedTicketIds.includes(t.id)));
    toast.success(`${selectedTicketIds.length} destek talebi silindi.`);
    setSelectedTicketIds([]);
    setIsBulkDeleteModalOpen(false);
    setIsBulkDropdownOpen(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicketId) return;

    const newMsg: Message = {
      senderName: 'Musharof Chowdhury',
      senderEmail: 'From - tailadmin support team',
      avatar: 'MC',
      role: 'agent',
      body: replyText,
      time: 'Just now',
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    setTickets((prevTickets) =>
      prevTickets.map((t) => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            messages: [...t.messages, newMsg],
          };
        }
        return t;
      })
    );

    setReplyText('');
    setAttachments([]);
  };

  const handleStatusChange = (status: 'Solved' | 'Pending' | 'In Progress' | 'On-Hold') => {
    if (!selectedTicketId) return;
    setTickets((prevTickets) =>
      prevTickets.map((t) => {
        if (t.id === selectedTicketId) {
          return { ...t, status };
        }
        return t;
      })
    );
  };

  return (
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 animate-fade-in min-h-screen font-sans bg-slate-50/50 dark:bg-kp-bg-primary">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-kp-text-primary">Support Ticket</h2>
        </div>
        <div className="flex items-center text-xs text-kp-text-tertiary gap-1.5 font-medium">
          <span>Home</span>
          <span>&gt;</span>
          <span className="font-semibold text-kp-text-secondary">Support Ticket</span>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedTicketId ? (
        /* ================= TICKET LIST VIEW ================= */
        <div className="space-y-6">
          {/* Top Metric Cards (Matches Screenshot) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Total tickets */}
            <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl p-6 flex items-center gap-5 shadow-2xs transition-shadow hover:shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex-shrink-0">
                <TicketIcon className="h-6 w-6 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">5,347</h3>
                <p className="text-xs font-medium text-kp-text-tertiary mt-0.5">Total tickets</p>
              </div>
            </div>

            {/* Card 2: Pending tickets */}
            <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl p-6 flex items-center gap-5 shadow-2xs transition-shadow hover:shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex-shrink-0">
                <ClockIcon className="h-6 w-6 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">1,230</h3>
                <p className="text-xs font-medium text-kp-text-tertiary mt-0.5">Pending tickets</p>
              </div>
            </div>

            {/* Card 3: Solved tickets */}
            <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl p-6 flex items-center gap-5 shadow-2xs transition-shadow hover:shadow-xs">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 stroke-[1.8]" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-kp-text-primary tracking-tight">4,117</h3>
                <p className="text-xs font-medium text-kp-text-tertiary mt-0.5">Solved tickets</p>
              </div>
            </div>
          </div>

          {/* Support Tickets Table Card */}
          <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl shadow-2xs p-6 space-y-6">
            {/* Header Controls Row */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-kp-text-primary">Support Tickets</h3>
                <p className="text-xs text-kp-text-tertiary mt-0.5">Your most recent support tickets list</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                {/* Segmented Filter Pills */}
                <div className="flex items-center border border-slate-200 dark:border-slate-700/80 rounded-xl p-1 bg-slate-50 dark:bg-slate-800/50">
                  {(['All', 'Solved', 'Pending'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        activeFilter === filter
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>

                {/* Search Box */}
                <div className="relative flex-1 sm:w-64 sm:flex-initial">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-white dark:bg-kp-bg-primary border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-kp-text-primary placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500 transition-colors"
                  />
                  <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                </div>

                {/* Filter Button */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFilterDropdownOpen(!isFilterDropdownOpen);
                    }}
                    className={`flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold transition-all ${
                      isFilterDropdownOpen || selectedCategories.length > 0
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                        : 'bg-white dark:bg-kp-bg-primary text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    <span>Filter</span>
                    {selectedCategories.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 bg-blue-600 text-white text-[0.5625rem] rounded-full">
                        {selectedCategories.length}
                      </span>
                    )}
                  </button>

                  {isFilterDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-56 bg-white dark:bg-kp-bg-secondary border border-kp-border rounded-xl shadow-xl z-20 p-4 text-left space-y-3 animate-fade-in"
                    >
                      <div className="text-[0.625rem] font-bold text-kp-text-tertiary uppercase tracking-wider pb-1 border-b border-kp-border">
                        Filter By Category
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {['General Support', 'Billing & Subscriptions', 'Technical Bug', 'Feature Request', 'Security Settings'].map((cat) => (
                          <label key={cat} className="flex items-center gap-2.5 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary cursor-pointer">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              checked={selectedCategories.includes(cat)}
                              onChange={() => {
                                setSelectedCategories(prev =>
                                  prev.includes(cat)
                                    ? prev.filter(c => c !== cat)
                                    : [...prev, cat]
                                );
                              }}
                            />
                            {cat}
                          </label>
                        ))}
                      </div>
                      {selectedCategories.length > 0 && (
                        <button
                          onClick={() => setSelectedCategories([])}
                          className="w-full text-center text-[0.6875rem] text-blue-600 hover:underline font-semibold pt-2 border-t border-kp-border mt-1 block"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="kp-table w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-[0.6875rem] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="w-12 py-3.5 px-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                        checked={filteredTickets.length > 0 && filteredTickets.every(t => selectedTicketIds.includes(t.id))}
                        onChange={handleToggleSelectAll}
                      />
                    </th>
                    <th className="py-3.5 px-4 font-bold">Ticket ID</th>
                    <th className="py-3.5 px-4 font-bold">
                      <div className="flex items-center justify-between">
                        <span>Requested By</span>
                        <ChevronUpDownIcon className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4 font-bold">Subject</th>
                    <th className="py-3.5 px-4 font-bold">
                      <div className="flex items-center justify-between">
                        <span>Create Date</span>
                        <ChevronUpDownIcon className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4 font-bold">Status</th>
                    <th className="w-12 py-3.5 px-4 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-kp-text-secondary">
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                          checked={selectedTicketIds.includes(ticket.id)}
                          onChange={() => handleToggleSelectTicket(ticket.id)}
                        />
                      </td>
                      <td className="py-4 px-4 font-semibold text-slate-800 dark:text-slate-200">{ticket.id}</td>
                      <td className="py-4 px-4">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">{ticket.customerName}</div>
                          <div className="text-[0.6875rem] font-medium text-slate-400">{ticket.customerEmail}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {ticket.subject}
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-500 dark:text-slate-400">{ticket.createDate}</td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[0.6875rem] font-bold ${
                            ticket.status === 'Solved'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-400 relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownTicketId(activeDropdownTicketId === ticket.id ? null : ticket.id);
                          }}
                          className="hover:text-slate-600 dark:hover:text-slate-200 px-2 py-1 rounded transition-colors"
                        >
                          •••
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TICKET DETAIL / THREAD VIEW ================= */
        selectedTicket && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start font-sans">
            {/* Left Hand Conversation Thread */}
            <div className="lg:col-span-2 space-y-6">
              {/* Main Detail Card */}
              <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl shadow-2xs p-6 sm:p-8 space-y-8">
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-kp-border">
                  <div className="flex items-start gap-4">
                    <button
                      onClick={() => setSelectedTicketId(null)}
                      className="mt-0.5 p-2 border border-kp-border hover:border-kp-border-hover rounded-xl text-kp-text-secondary hover:text-kp-text-primary transition-colors flex-shrink-0"
                      title={t('backToList')}
                    >
                      <ArrowUturnLeftIcon className="h-4 w-4" />
                    </button>
                    <div>
                      <h3 className="text-lg font-bold text-kp-text-primary tracking-tight">
                        Ticket {selectedTicket.id} - {selectedTicket.subject}
                      </h3>
                      <p className="text-xs font-medium text-kp-text-tertiary mt-1">
                        Mon, 3:20 PM (2 days ago)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
                    <span className="text-xs font-semibold text-kp-text-tertiary">4 of 120</span>
                    <div className="flex items-center gap-1.5">
                      <button className="flex h-8 w-8 items-center justify-center rounded-full border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors">
                        <ChevronLeftIcon className="h-4 w-4" />
                      </button>
                      <button className="flex h-8 w-8 items-center justify-center rounded-full border border-kp-border text-kp-text-secondary hover:bg-kp-bg-hover hover:text-kp-text-primary transition-colors">
                        <ChevronRightIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Messages Feed */}
                <div className="space-y-8 pr-1">
                  {selectedTicket.messages.map((msg, i) => (
                    <div key={i} className="space-y-4">
                      {/* Sender Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3.5">
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs ${
                            msg.role === 'agent'
                              ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                              : 'bg-gradient-to-br from-amber-500 to-rose-500'
                          }`}>
                            {msg.avatar}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-kp-text-primary">{msg.senderName}</div>
                            <div className="text-xs font-medium text-kp-text-tertiary">{msg.senderEmail}</div>
                          </div>
                        </div>
                        <div className="text-xs font-medium text-kp-text-tertiary">{msg.time}</div>
                      </div>

                      {/* Message Body */}
                      <div className="pl-13 text-sm font-medium text-kp-text-secondary leading-relaxed whitespace-pre-line">
                        {msg.body}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2.5 mt-4 pt-3 border-t border-kp-border/50">
                            {msg.attachments.map((src, idx) => (
                              <img
                                key={idx}
                                src={src}
                                alt="attachment"
                                className="max-w-[220px] max-h-[160px] object-cover rounded-xl border border-kp-border shadow-2xs hover:scale-[1.02] transition-transform duration-200 cursor-zoom-in"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply Form */}
                <form onSubmit={handleSendReply} className="pt-4 space-y-6">
                  <div className="rounded-2xl border border-kp-border p-4 focus-within:border-kp-accent focus-within:ring-1 focus-within:ring-kp-accent transition-all bg-white dark:bg-kp-bg-secondary">
                    <textarea
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply here..."
                      className="w-full bg-transparent border-none text-sm font-medium text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:ring-0 resize-none h-32"
                    />

                    {/* Hidden File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    {/* Attachment Thumbnail Previews */}
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-3 pb-3 mb-3 border-b border-kp-border/50">
                        {attachments.map((src, idx) => (
                          <div key={idx} className="relative w-16 h-16 border border-kp-border rounded-xl overflow-hidden group shadow-2xs">
                            <img src={src} alt="preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-kp-border/40">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                      >
                        <PaperClipIcon className="h-4 w-4" />
                        <span>Attach</span>
                      </button>
                      <button
                        type="submit"
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-7 py-2.5 text-xs font-bold shadow-2xs transition-colors"
                      >
                        Reply
                      </button>
                    </div>
                  </div>

                  {/* Status Toggle Bar */}
                  <div className="flex items-center gap-6 text-xs font-semibold pl-1">
                    <span className="text-kp-text-tertiary">Status:</span>
                    <label className="flex items-center gap-2 font-semibold text-kp-text-primary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'In Progress'}
                        onChange={() => handleStatusChange('In Progress')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-kp-border"
                      />
                      In-Progress
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-kp-text-secondary hover:text-kp-text-primary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'Solved'}
                        onChange={() => handleStatusChange('Solved')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-kp-border"
                      />
                      Solved
                    </label>
                    <label className="flex items-center gap-2 font-semibold text-kp-text-secondary hover:text-kp-text-primary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'On-Hold'}
                        onChange={() => handleStatusChange('On-Hold')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-kp-border"
                      />
                      On-Hold
                    </label>
                  </div>
                </form>
              </div>
            </div>

            {/* Right Hand Ticket Details Sidebar */}
            <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border/80 rounded-2xl shadow-2xs p-6 sm:p-8 space-y-6">
              <h3 className="text-base font-bold text-kp-text-primary tracking-tight border-b border-kp-border pb-4">
                Ticket Details
              </h3>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-kp-border/50">
                  <span className="text-kp-text-tertiary font-medium">Customer</span>
                  <span className="text-kp-text-primary font-bold text-sm">{selectedTicket.customerName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-kp-border/50">
                  <span className="text-kp-text-tertiary font-medium">Email</span>
                  <span className="text-kp-text-secondary font-medium font-mono">{selectedTicket.customerEmail}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-kp-border/50">
                  <span className="text-kp-text-tertiary font-medium">Ticket ID</span>
                  <span className="text-kp-text-primary font-mono font-semibold">{selectedTicket.id}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-kp-border/50">
                  <span className="text-kp-text-tertiary font-medium">Category</span>
                  <span className="text-kp-text-secondary font-semibold">{selectedTicket.category}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-kp-border/50">
                  <span className="text-kp-text-tertiary font-medium">Created</span>
                  <span className="text-kp-text-secondary font-semibold">{selectedTicket.createDate}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-kp-text-tertiary font-medium">Status</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    {selectedTicket.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <h3 className="text-sm font-semibold text-kp-text-primary flex items-center gap-2">
                <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger" /> {t('bulkDeleteModal.title')}
              </h3>
              <button
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="text-kp-text-tertiary hover:text-kp-text-primary transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-kp-text-secondary leading-relaxed">
                {t.rich('bulkDeleteModal.desc', {
                  count: selectedTicketIds.length,
                  b: (chunks) => <span className="font-bold text-kp-danger">{chunks}</span>,
                })}
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-kp-bg-primary/50 border-t border-kp-border">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
              >
                {tc('actions.cancel')}
              </button>
              <button
                type="button"
                onClick={handleBulkDeleteConfirm}
                className="flex items-center gap-1.5 rounded-kp-md bg-kp-danger hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-all"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                {t('bulkDeleteModal.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
