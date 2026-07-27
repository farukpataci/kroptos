'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LifebuoyIcon,
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
  ChevronDownIcon,
  TrashIcon,
  ExclamationTriangleIcon,
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
        time: 'Mon, 3:20 PM (2 days ago)'
      },
      {
        senderName: 'Musharof Chowdhury',
        senderEmail: 'support@kroptos.com',
        avatar: 'MC',
        role: 'agent',
        body: 'Hello Lindsey,\nWe checked your firewall logs. Your IP was temporarily blocked due to multiple failed password attempts. We have whitelisted it now. Please try logging in again.',
        time: 'Mon, 4:10 PM (2 days ago)'
      }
    ]
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
        time: 'Mon, 3:20 PM'
      }
    ]
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
        time: 'Tue, 11:30 AM'
      }
    ]
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
        body: 'We need to sync with local billing providers in Turkey. Can you build an integration for iyzico?',
        time: 'Wed, 9:00 AM'
      }
    ]
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
        body: 'Reset password link is not arriving to my inbox. Can you manually trigger it or reset it for me?',
        time: 'Fri, 2:00 PM'
      }
    ]
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
        body: 'Do you plan to release a fully unified dark theme across all dashboard widgets soon?',
        time: 'Sat, 1:45 PM'
      }
    ]
  },
  {
    id: '#323540',
    customerName: 'Jane Smith',
    customerEmail: 'jane.smith@email.com',
    avatar: 'JS',
    subject: 'Error 500 on Dashboard',
    createDate: '01 May, 2027',
    category: 'General Support',
    status: 'Pending',
    messages: [
      {
        senderName: 'Jane Smith',
        senderEmail: 'jane.smith@email.com',
        avatar: 'JS',
        role: 'customer',
        body: 'I get a Server 500 error when pulling inventory sync report for last month.',
        time: 'Mon, 10:00 AM'
      }
    ]
  }
];

export default function SupportTicketsPage() {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
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

  // Statistics calculated dynamically from local tickets state
  const totalCount = tickets.length;
  const pendingCount = tickets.filter(
    (t) => t.status === 'Pending' || t.status === 'In Progress' || t.status === 'On-Hold'
  ).length;
  const solvedCount = tickets.filter((t) => t.status === 'Solved').length;

  // Filter & Search Table
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = activeFilter === 'All' ? true : t.status === activeFilter;
    
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

  const handleBulkStatusChange = (status: 'Solved' | 'Pending') => {
    if (selectedTicketIds.length === 0) return;
    setTickets((prev) =>
      prev.map((t) => (selectedTicketIds.includes(t.id) ? { ...t, status } : t))
    );
    toast.success(t('bulkStatusUpdated', { count: selectedTicketIds.length, status: status === 'Solved' ? t('statusSolved') : t('statusPending') }));
    setSelectedTicketIds([]);
    setIsBulkDropdownOpen(false);
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
      senderName: 'Musharof Chowdhury', // Agent persona
      senderEmail: 'support@kroptos.com',
      avatar: 'MC',
      role: 'agent',
      body: replyText,
      time: 'Just now',
      attachments: attachments.length > 0 ? [...attachments] : undefined
    };

    setTickets((prevTickets) =>
      prevTickets.map((t) => {
        if (t.id === selectedTicketId) {
          return {
            ...t,
            messages: [...t.messages, newMsg]
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
    <div className="flex-1 space-y-6 p-6 md:p-8 pt-6 animate-fade-in min-h-screen">
      {/* Top Breadcrumb & Title */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-kp-text-primary">Support Ticket</h2>
        </div>
        <div className="flex items-center text-xs text-kp-text-tertiary gap-1">
          <span>Home</span>
          <span>&gt;</span>
          <span className="font-semibold text-kp-text-secondary">Support Ticket</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total */}
        <div className="bg-white dark:bg-kp-bg-secondary rounded-kp-lg border border-kp-border p-5 flex items-center gap-5 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-kp-md bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600">
            <TicketIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-kp-text-primary">{totalCount.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mt-0.5">Total tickets</div>
          </div>
        </div>

        {/* Card 2: Pending */}
        <div className="bg-white dark:bg-kp-bg-secondary rounded-kp-lg border border-kp-border p-5 flex items-center gap-5 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-kp-md bg-amber-50 dark:bg-amber-950/30 text-amber-600">
            <ClockIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-kp-text-primary">{pendingCount.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mt-0.5">Pending tickets</div>
          </div>
        </div>

        {/* Card 3: Solved */}
        <div className="bg-white dark:bg-kp-bg-secondary rounded-kp-lg border border-kp-border p-5 flex items-center gap-5 shadow-xs">
          <div className="flex h-12 w-12 items-center justify-center rounded-kp-md bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-kp-text-primary">{solvedCount.toLocaleString()}</div>
            <div className="text-[11px] font-semibold text-kp-text-tertiary uppercase tracking-wider mt-0.5">Solved tickets</div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {!selectedTicketId ? (
        /* ================= TICKET LIST VIEW ================= */
        <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-kp-text-primary">Support Tickets</h3>
              <p className="text-xs text-kp-text-tertiary">Your most recent support tickets list</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center w-full sm:w-auto">
              {/* Tab Filters */}
              <div className="flex border border-kp-border rounded-kp-md p-0.5 bg-kp-bg-secondary flex-shrink-0">
                {(['All', 'Solved', 'Pending'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-kp-sm transition-all ${
                      activeFilter === filter
                        ? 'bg-kp-bg-primary text-kp-text-primary shadow-xs'
                        : 'text-kp-text-tertiary hover:text-kp-text-secondary'
                    }`}
                  >
                    {filter === 'All' ? 'All' : filter === 'Solved' ? 'Solved' : 'Pending'}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-60">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-4 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2 h-4 w-4 text-kp-text-tertiary" />
              </div>

              {/* Filter Action Dropdown */}
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFilterDropdownOpen(!isFilterDropdownOpen);
                  }}
                  className={`flex items-center gap-1.5 rounded-kp-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                    isFilterDropdownOpen || selectedCategories.length > 0
                      ? 'border-kp-accent bg-kp-accent/5 text-kp-accent'
                      : 'border-kp-border bg-kp-bg-primary text-kp-text-secondary hover:text-kp-text-primary'
                  }`}
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  Filter
                  {selectedCategories.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 bg-kp-accent text-white text-[9px] rounded-full">
                      {selectedCategories.length}
                    </span>
                  )}
                </button>

                {isFilterDropdownOpen && (
                  <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute right-0 mt-2 w-56 bg-kp-bg-primary border border-kp-border rounded-kp-md shadow-lg z-20 p-3 text-left space-y-2 animate-fade-in"
                  >
                    <div className="text-[10px] font-bold text-kp-text-tertiary uppercase tracking-wider pb-1 border-b border-kp-border">
                      {t('filterByCategory')}
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {['General Support', 'Billing & Subscriptions', 'Technical Bug', 'Feature Request', 'Security Settings'].map((cat) => (
                        <label key={cat} className="flex items-center gap-2 text-xs font-medium text-kp-text-secondary hover:text-kp-text-primary cursor-pointer py-0.5">
                          <input
                            type="checkbox"
                            className="rounded-kp-sm border-kp-border text-kp-accent focus:ring-kp-accent"
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
                        className="w-full text-center text-[10px] text-kp-accent hover:underline font-semibold pt-1 border-t border-kp-border mt-1 block"
                      >
                        {tc('actions.clear')}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bulk Actions Dropdown next to Filter */}
              {selectedTicketIds.length > 0 && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsBulkDropdownOpen(!isBulkDropdownOpen);
                    }}
                    className="flex items-center gap-1.5 rounded-kp-md border border-kp-accent bg-kp-accent text-white px-3 py-1.5 text-xs font-semibold shadow-xs transition-all hover:bg-kp-accent-hover"
                  >
                    <span>{t('bulkActions', { count: selectedTicketIds.length })}</span>
                    <ChevronDownIcon className="h-3.5 w-3.5" />
                  </button>

                  {isBulkDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 mt-2 w-48 bg-kp-bg-primary border border-kp-border rounded-kp-md shadow-lg z-30 py-1 text-left space-y-0.5 animate-fade-in"
                    >
                      <button
                        onClick={() => handleBulkStatusChange('Solved')}
                        className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-emerald-600 hover:text-emerald-700 text-xs font-semibold flex items-center gap-2 transition-colors text-left"
                      >
                        <CheckCircleIcon className="h-4 w-4" />
                        {t('markSolved')}
                      </button>
                      <button
                        onClick={() => handleBulkStatusChange('Pending')}
                        className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-amber-600 hover:text-amber-700 text-xs font-semibold flex items-center gap-2 transition-colors text-left"
                      >
                        <ClockIcon className="h-4 w-4" />
                        {t('markPending')}
                      </button>
                      <div className="border-t border-kp-border my-1" />
                      <button
                        onClick={() => setIsBulkDeleteModalOpen(true)}
                        className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-kp-danger hover:text-red-700 text-xs font-semibold flex items-center gap-2 transition-colors text-left"
                      >
                        <TrashIcon className="h-4 w-4" />
                        {t('bulkDelete')}
                      </button>
                      <button
                        onClick={() => setSelectedTicketIds([])}
                        className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-kp-text-tertiary text-xs font-medium flex items-center gap-2 transition-colors text-left"
                      >
                        <XMarkIcon className="h-4 w-4" />
                        {t('clearSelection')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-kp-border rounded-kp-md overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-kp-border bg-kp-bg-primary/20 text-[10px] font-bold uppercase tracking-wider text-kp-text-tertiary">
                  <th className="w-10 py-3 px-4">
                    <input 
                      type="checkbox" 
                      className="rounded-kp-sm border-kp-border text-kp-accent focus:ring-kp-accent" 
                      checked={filteredTickets.length > 0 && filteredTickets.every(t => selectedTicketIds.includes(t.id))}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Create Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="w-12 py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-kp-border text-kp-text-secondary">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className="hover:bg-kp-bg-hover/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="rounded-kp-sm border-kp-border text-kp-accent focus:ring-kp-accent" 
                        checked={selectedTicketIds.includes(ticket.id)}
                        onChange={() => handleToggleSelectTicket(ticket.id)}
                      />
                    </td>
                    <td className="py-3.5 px-4 font-bold text-kp-accent">{ticket.id}</td>
                    <td className="py-3.5 px-4">
                      <div>
                        <div className="font-semibold text-kp-text-primary">{ticket.customerName}</div>
                        <div className="text-[10px] text-kp-text-tertiary">{ticket.customerEmail}</div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-kp-text-secondary max-w-xs truncate">
                      {ticket.subject}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-kp-text-tertiary">{ticket.createDate}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ticket.status === 'Solved'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                        }`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-kp-text-tertiary relative" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdownTicketId(activeDropdownTicketId === ticket.id ? null : ticket.id);
                        }}
                        className="hover:text-kp-text-primary px-2 py-1 rounded transition-colors"
                      >
                        •••
                      </button>

                      {activeDropdownTicketId === ticket.id && (
                        <div className="absolute right-4 mt-1 w-36 bg-kp-bg-primary border border-kp-border rounded-kp-md shadow-lg z-20 py-1 text-left">
                          <button
                            onClick={() => {
                              setSelectedTicketId(ticket.id);
                              setActiveDropdownTicketId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-kp-text-secondary hover:text-kp-text-primary text-[11px] font-semibold transition-colors block text-left"
                          >
                            {t('viewDetails')}
                          </button>
                          <button
                            onClick={() => {
                              setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'Solved' } : t));
                              setActiveDropdownTicketId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-kp-text-secondary hover:text-kp-text-primary text-[11px] font-semibold transition-colors block text-left"
                          >
                            {t('markSolved')}
                          </button>
                          <button
                            onClick={() => {
                              setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, status: 'Pending' } : t));
                              setActiveDropdownTicketId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-kp-bg-secondary text-kp-text-secondary hover:text-kp-text-primary text-[11px] font-semibold transition-colors block text-left"
                          >
                            {t('markPending')}
                          </button>
                          <div className="border-t border-kp-border my-1"></div>
                          <button
                            onClick={() => {
                              setTickets(prev => prev.filter(t => t.id !== ticket.id));
                              setActiveDropdownTicketId(null);
                            }}
                            className="w-full px-3 py-1.5 hover:bg-red-50 text-red-600 text-[11px] font-semibold transition-colors block text-left"
                          >
                            {tc('actions.delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-kp-text-tertiary">
              Showing 1 to {filteredTickets.length} of {filteredTickets.length}
            </span>
            <div className="flex gap-1.5">
              <button className="flex h-7 w-7 items-center justify-center rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-kp-text-primary transition-all">
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button className="flex h-7 w-7 items-center justify-center rounded-kp-md bg-kp-accent text-white font-semibold text-xs transition-all">
                1
              </button>
              <button className="flex h-7 w-7 items-center justify-center rounded-kp-md border border-kp-border text-kp-text-secondary hover:text-kp-text-primary transition-all">
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ================= TICKET DETAIL / THREAD VIEW ================= */
        selectedTicket && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-start">
            {/* Left Hand Conversation Thread */}
            <div className="lg:col-span-2 space-y-6">
              {/* Thread Container */}
              <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border rounded-2xl shadow-sm p-6 space-y-6">
                
                {/* Back button and title */}
                <div className="flex items-center justify-between pb-4 border-b border-kp-border">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedTicketId(null)}
                      className="p-1.5 border border-kp-border hover:border-kp-border-hover rounded-kp-md text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                      title={t('backToList')}
                    >
                      <ArrowUturnLeftIcon className="h-4 w-4" />
                    </button>
                    <div>
                      <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wide">
                        Ticket {selectedTicket.id} - {selectedTicket.subject}
                      </h3>
                      <p className="text-[10px] text-kp-text-tertiary">Mon, 3:20 PM (2 days ago)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-kp-text-tertiary">
                    <span>1 of 12</span>
                    <div className="flex gap-1">
                      <button className="p-1 border border-kp-border rounded hover:bg-kp-bg-hover">
                        <ChevronLeftIcon className="h-3 w-3" />
                      </button>
                      <button className="p-1 border border-kp-border rounded hover:bg-kp-bg-hover">
                        <ChevronRightIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Conversation Balloons */}
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-1">
                  {selectedTicket.messages.map((msg, i) => {
                    const isAgent = msg.role === 'agent';
                    return (
                      <div key={i} className={`flex gap-4 items-start ${isAgent ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${isAgent ? 'bg-kp-accent' : 'bg-amber-600'}`}>
                          {msg.avatar}
                        </div>
                        {/* Message details */}
                        <div className="flex-1 space-y-1.5">
                          <div className={`flex items-center justify-between ${isAgent ? 'flex-row-reverse' : ''}`}>
                            <div className={isAgent ? 'text-right' : 'text-left'}>
                              <span className="text-xs font-bold text-kp-text-primary">{msg.senderName}</span>
                              {msg.senderEmail && (
                                <span className="text-[10px] text-kp-text-tertiary ml-2 font-mono">{msg.senderEmail}</span>
                              )}
                            </div>
                            <span className="text-[10px] text-kp-text-tertiary">{msg.time}</span>
                          </div>
                          
                          {/* Body */}
                          <div className={`rounded-2xl px-4 py-3 border text-xs leading-relaxed ${
                            isAgent 
                              ? 'bg-kp-accent/5 border-kp-accent/20 text-kp-text-secondary text-left ml-12' 
                              : 'bg-kp-bg-secondary border-kp-border text-kp-text-secondary text-left mr-12'
                          }`}>
                            <div>{msg.body}</div>
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-kp-border/50">
                                {msg.attachments.map((src, idx) => (
                                  <img 
                                    key={idx} 
                                    src={src} 
                                    alt="attachment" 
                                    className="max-w-[200px] max-h-[150px] object-cover rounded-kp-md border border-kp-border/60 shadow-xs hover:scale-[1.02] transition-transform duration-200 cursor-zoom-in" 
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Editor Form */}
                <form onSubmit={handleSendReply} className="border-t border-kp-border pt-6 space-y-4">
                  <div className="bg-kp-bg-secondary rounded-2xl border border-kp-border p-3 focus-within:border-kp-accent transition-colors">
                    <textarea
                      required
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply here..."
                      className="w-full bg-transparent border-none text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden resize-none h-28"
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
                      <div className="flex flex-wrap gap-3 pb-3 mb-2 border-b border-kp-border/40">
                        {attachments.map((src, idx) => (
                          <div key={idx} className="relative w-14 h-14 border border-kp-border rounded-kp-md overflow-hidden group">
                            <img src={src} alt="preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx)}
                              className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 transition-colors"
                            >
                              <XMarkIcon className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between border-t border-kp-border/60 pt-3 mt-2 text-xs">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1 text-[11px] font-semibold text-kp-text-secondary hover:text-kp-text-primary transition-colors"
                      >
                        <PaperClipIcon className="h-4 w-4" />
                        Attach
                      </button>
                      <button
                        type="submit"
                        className="rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-5 py-1.5 text-xs font-semibold shadow-sm transition-colors"
                      >
                        Reply
                      </button>
                    </div>
                  </div>

                  {/* Reply Status Toggle */}
                  <div className="flex items-center gap-6 text-xs pl-1">
                    <span className="font-semibold text-kp-text-tertiary">Status:</span>
                    <label className="flex items-center gap-1.5 font-medium text-kp-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'In Progress'}
                        onChange={() => handleStatusChange('In Progress')}
                        className="text-kp-accent focus:ring-kp-accent border-kp-border"
                      />
                      In-Progress
                    </label>
                    <label className="flex items-center gap-1.5 font-medium text-kp-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'Solved'}
                        onChange={() => handleStatusChange('Solved')}
                        className="text-kp-accent focus:ring-kp-accent border-kp-border"
                      />
                      Solved
                    </label>
                    <label className="flex items-center gap-1.5 font-medium text-kp-text-secondary cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        checked={selectedTicket.status === 'On-Hold'}
                        onChange={() => handleStatusChange('On-Hold')}
                        className="text-kp-accent focus:ring-kp-accent border-kp-border"
                      />
                      On-Hold
                    </label>
                  </div>
                </form>

              </div>
            </div>

            {/* Right Hand Ticket Details Sidebar */}
            <div className="bg-white dark:bg-kp-bg-secondary border border-kp-border rounded-2xl shadow-sm p-6 space-y-4">
              <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wide pb-2 border-b border-kp-border">
                Ticket Details
              </h3>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Customer</span>
                  <span className="text-kp-text-primary font-semibold">{selectedTicket.customerName}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Email</span>
                  <span className="text-kp-text-primary font-semibold font-mono">{selectedTicket.customerEmail}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Ticket ID</span>
                  <span className="text-kp-text-primary font-mono font-bold text-kp-accent">{selectedTicket.id}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Category</span>
                  <span className="text-kp-text-primary font-semibold">{selectedTicket.category}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Created</span>
                  <span className="text-kp-text-primary font-semibold">{selectedTicket.createDate}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-kp-text-tertiary font-medium">Status</span>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      selectedTicket.status === 'Solved'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : selectedTicket.status === 'In Progress'
                        ? 'bg-indigo-500/10 text-indigo-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
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
