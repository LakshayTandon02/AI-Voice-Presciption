import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  PlusCircle, 
  History, 
  LayoutDashboard, 
  Mic, 
  MicOff, 
  Search, 
  Save, 
  Printer, 
  MessageSquare,
  UserPlus,
  ArrowRight,
  TrendingUp,
  Activity,
  Calendar,
  LogIn,
  LogOut,
  Menu,
  X,
  Trash2,
  ChevronLeft,
  Stethoscope,
  Clipboard,
  FileText,
  Edit,
  Check
} from 'lucide-react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  orderBy, 
  doc,
  setDoc,
  onSnapshot,
  where
} from 'firebase/firestore';
import { db, auth, googleProvider, signInWithPopup, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { cn, formatDate } from './lib/utils';
import { 
  Patient, 
  Visit, 
  Prescription, 
  Medicine, 
  ExtractedPrescription 
} from './types';
import { parsePrescriptionFromVoice, hospitalChatbot } from './services/aiService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar,
  Cell
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateProfessionalPDF } from './lib/pdfGenerator';

// --- Sub-components ---

type Tab = 'dashboard' | 'patients' | 'consult' | 'history' | 'chat';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Week');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  
  // Dashboard state
  const [stats, setStats] = useState({ totalPatients: 0, todayVisits: 0, totalRevenue: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Real-time Dashboard Monitoring
    const unsubs: (() => void)[] = [];
    
    // Total Patients Listener
    const pUnsub = onSnapshot(collection(db, 'patients'), (snapshot) => {
      const pList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
      setPatients(pList);
      setStats(prev => ({ ...prev, totalPatients: snapshot.size }));
    });
    unsubs.push(pUnsub);

    // Visits & Revenue Listener
    const vUnsub = onSnapshot(collection(db, 'visits'), (snapshot) => {
      const visits = snapshot.docs.map(doc => doc.data());
      const todayStr = new Date().toISOString().split('T')[0];
      
      const todayVisitsCount = visits.filter(v => v.date.startsWith(todayStr)).length;
      const totalRevenue = snapshot.size * 200;

      setStats(prev => ({ 
        ...prev, 
        todayVisits: todayVisitsCount,
        totalRevenue: totalRevenue
      }));

      // Aggregated Analytics Generator
      let aggregatedData: any[] = [];
      const now = new Date();

      if (timeRange === 'Day') {
        // Last 24 Hours in 3-hour bins
        aggregatedData = [...Array(8)].map((_, i) => {
          const d = new Date(now);
          d.setHours(d.getHours() - (7 - i) * 3);
          const hourLabel = d.getHours() + ":00";
          const count = visits.filter(v => {
            const vDate = new Date(v.date);
            return vDate >= new Date(d.getTime() - 1.5 * 60 * 60 * 1000) && 
                   vDate < new Date(d.getTime() + 1.5 * 60 * 60 * 1000);
          }).length;
          return { name: hourLabel, visits: count, revenue: count * 200 };
        });
      } else if (timeRange === 'Week') {
        // Last 7 days
        aggregatedData = [...Array(7)].map((_, i) => {
          const d = new Date(now);
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
          const dayVisits = visits.filter(v => v.date.startsWith(dateStr)).length;
          return { name: dayName, visits: dayVisits, revenue: dayVisits * 200 };
        });
      } else if (timeRange === 'Month') {
        // Last 4 weeks
        aggregatedData = [...Array(4)].map((_, i) => {
          const d = new Date(now);
          d.setDate(d.getDate() - (3 - i) * 7);
          const label = `Week ${i + 1}`;
          const weekVisits = visits.filter(v => {
            const vDate = new Date(v.date);
            const start = new Date(d.getTime() - 3.5 * 24 * 60 * 60 * 1000);
            const end = new Date(d.getTime() + 3.5 * 24 * 60 * 60 * 1000);
            return vDate >= start && vDate < end;
          }).length;
          return { name: label, visits: weekVisits, revenue: weekVisits * 200 };
        });
      } else {
        // Year - Last 12 months
        aggregatedData = [...Array(12)].map((_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
          const monthLabel = d.toLocaleDateString('en-US', { month: 'short' });
          const monthVisits = visits.filter(v => {
            const vDate = new Date(v.date);
            return vDate.getMonth() === d.getMonth() && vDate.getFullYear() === d.getFullYear();
          }).length;
          return { name: monthLabel, visits: monthVisits, revenue: monthVisits * 200 };
        });
      }
      
      setChartData(aggregatedData);
    });
    unsubs.push(vUnsub);

    return () => {
      unsubscribeAuth();
      unsubs.forEach(u => u());
    };
  }, [timeRange]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex h-screen bg-[#f0f4f8] text-slate-900 font-sans selection:bg-blue-100 relative">
      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 lg:static w-52 bg-blue-900 flex flex-col border-r border-blue-800 shadow-xl z-40 transition-transform duration-300 transform",
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-4 border-b border-blue-800 bg-blue-950 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="font-bold text-lg leading-tight uppercase tracking-wider text-white">Dr. Deepak</h1>
            <p className="text-[10px] opacity-70 text-blue-200">Hospital Command Center v2.1</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-blue-200">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-2 space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'consult', label: 'New Consultation', icon: PlusCircle },
            { id: 'history', label: 'Visit History', icon: History },
            { id: 'chat', label: 'Assistant', icon: MessageSquare },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as Tab); setSidebarOpen(false); }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-all duration-200",
                activeTab === item.id 
                  ? "bg-blue-800 text-white shadow-inner" 
                  : "text-blue-200 hover:bg-blue-800 hover:text-white"
              )}
            >
              <item.icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-blue-800 bg-blue-950">
          {user ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                  alt="Avatar" 
                  className="w-8 h-8 rounded shrink-0" 
                  referrerPolicy="no-referrer" 
                />
                <div className="text-white overflow-hidden">
                  <p className="text-xs font-bold leading-none truncate">{user.displayName}</p>
                  <p className="text-[10px] opacity-60 italic mt-1 font-medium truncate">{user.email}</p>
                </div>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-1.5 border border-blue-800 rounded text-[10px] font-bold text-blue-200 hover:bg-red-900/40 hover:text-white transition-all"
              >
                <LogOut className="w-3 h-3" />
                Sign Out
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 rounded text-xs font-bold text-white hover:bg-blue-500 transition-all shadow-lg"
            >
              <LogIn className="w-3.5 h-3.5" />
              Dr. Deepak Access
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-12 bg-white border-b flex items-center justify-between px-4 lg:px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-2 lg:gap-4 w-full max-w-xl">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded">
               <Menu className="w-5 h-5" />
             </button>
             <div className="relative w-full">
               <input 
                type="text" 
                placeholder="Search patient by name or phone..." 
                className="w-full text-xs border rounded py-1.5 pl-8 bg-slate-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
               />
               <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
               
               {/* Search Results Dropdown */}
               <AnimatePresence>
                 {globalSearch && (
                   <motion.div 
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-xl z-50 max-h-60 overflow-y-auto custom-scrollbar"
                   >
                     {patients.filter(p => p.name.toLowerCase().includes(globalSearch.toLowerCase()) || p.phone.includes(globalSearch)).length > 0 ? (
                       patients.filter(p => p.name.toLowerCase().includes(globalSearch.toLowerCase()) || p.phone.includes(globalSearch)).map(p => (
                         <button
                           key={p.id}
                           onClick={() => {
                             setSelectedPatient(p);
                             setActiveTab('consult');
                             setGlobalSearch('');
                           }}
                           className="w-full text-left p-3 hover:bg-blue-50 border-b last:border-0 flex items-center justify-between transition-colors"
                         >
                           <div>
                             <p className="text-xs font-bold text-slate-800">{p.name}</p>
                             <p className="text-[10px] text-slate-400">{p.phone} • {p.age}y {p.gender}</p>
                           </div>
                           <ArrowRight className="w-3 h-3 text-blue-400" />
                         </button>
                       ))
                     ) : (
                       <div className="p-4 text-center text-xs text-slate-400 italic">No patients found matching "{globalSearch}"</div>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Live Status
            </div>
            <div className="border-l pl-4 border-slate-200">
              {formatDate(new Date().toISOString())}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <Dashboard 
                stats={stats} 
                chartData={chartData} 
                timeRange={timeRange}
                setTimeRange={setTimeRange}
              />
            )}
            {activeTab === 'patients' && <PatientManagement 
              patients={patients}
              onSelect={(p) => { setSelectedPatient(p); setActiveTab('consult'); }} 
              onViewHistory={(p) => { setSelectedPatient(p); setActiveTab('patient-history'); }}
            />}
            {activeTab === 'patient-history' && selectedPatient && (
              <PatientHistory 
                patient={selectedPatient} 
                onBack={() => setActiveTab('patients')} 
              />
            )}
            {activeTab === 'consult' && <Consultation initialPatient={selectedPatient} onComplete={() => setActiveTab('history')} />}
            {activeTab === 'history' && <VisitHistory />}
            {activeTab === 'chat' && <HospitalChat />}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// --- Views Components ---

function Dashboard({ stats, chartData, timeRange, setTimeRange }: any) {
  const currentRevenue = stats.totalRevenue || 0;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 lg:space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-bold text-slate-900">Hospital Command Center</h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Analytics Feed • {new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}
            </p>
            <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-200">
              {['Day', 'Week', 'Month', 'Year'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-3 py-1 rounded-md text-[10px] font-bold transition-all",
                    timeRange === range ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Payout Fee</p>
            <p className="text-sm font-bold text-blue-600">₹200 / Patient</p>
          </div>
          <div className="w-px h-8 bg-slate-100 mx-2" />
          <TrendingUp className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Base Patients', value: stats.totalPatients, icon: Users, color: 'bg-blue-50 text-blue-600', trend: 'Lifetime' },
          { label: 'OPD Footfall Today', value: stats.todayVisits, icon: Calendar, color: 'bg-emerald-50 text-emerald-600', trend: 'Live' },
          { label: 'Gross Revenue', value: `₹${currentRevenue.toLocaleString()}`, icon: TrendingUp, color: 'bg-amber-50 text-amber-600', trend: 'Total' },
          { label: 'Active Sessions', value: 'Active', icon: Activity, color: 'bg-indigo-50 text-indigo-600', trend: 'Operational' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 lg:p-6 border rounded-xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-2.5 rounded-lg", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 mb-1">{stat.label}</p>
              <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</h4>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <stat.icon className="w-24 h-24" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white p-6 border rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Clinical Load Index</h3>
              <p className="text-xs text-slate-400">Aggregated patient visits over the last 7 sessions.</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" /> Visits
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 500}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 500}} 
                />
                <Tooltip 
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    padding: '8px 12px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="visits" 
                  stroke="#2563eb" 
                  strokeWidth={3} 
                  dot={{r: 4, fill: '#fff', stroke: '#2563eb', strokeWidth: 2}} 
                  activeDot={{r: 6, stroke: '#fff', strokeWidth: 2}}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white p-6 border rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Financial Snapshot</h3>
              <p className="text-xs text-slate-400">Revenue generation trend @ ₹200 fee.</p>
            </div>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 500}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 500}}
                />
                <Tooltip 
                   cursor={{ fill: '#f8fafc' }}
                   contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    padding: '8px 12px'
                  }}
                   formatter={(value: any) => [`₹${value}`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="bg-blue-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-xl">
          <h3 className="text-xl font-bold mb-2">Advanced Clinical Analytics</h3>
          <p className="text-blue-100 text-sm leading-relaxed mb-6">
            Your hospital is processing real-time clinical data. Every voice prescription, visit log, and patient record contributes to these live insights.
          </p>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
              <p className="text-[10px] uppercase font-bold text-blue-300">Net Efficiency</p>
              <p className="text-lg font-bold">98.4%</p>
            </div>
            <div className="px-4 py-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
              <p className="text-[10px] uppercase font-bold text-blue-300">Sync Latency</p>
              <p className="text-lg font-bold">~240ms</p>
            </div>
          </div>
        </div>
        <Activity className="absolute -right-8 -bottom-8 w-64 h-64 text-white/5 rotate-12" />
      </div>
    </motion.div>
  );
}

function PatientManagement({ patients, onSelect, onViewHistory }: { patients: Patient[], onSelect: (p: Patient) => void, onViewHistory: (p: Patient) => void }) {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [newPatient, setNewPatient] = useState({ 
    name: '', 
    phone: '', 
    age: '', 
    gender: 'Male',
    initialSymptoms: '',
    initialDiagnosis: ''
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.phone) return;
    
    // Validate 10-digit phone number
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(newPatient.phone)) {
      alert("Invalid Phone Number. Please enter exactly 10 digits.");
      return;
    }

    try {
      if (!auth.currentUser) {
        alert("Please sign in to register patients.");
        return;
      }
      await setDoc(doc(db, 'patients', newPatient.phone), {
        ...newPatient,
        age: Number(newPatient.age),
        createdAt: new Date().toISOString(),
        creatorId: auth.currentUser?.uid || null
      });
      setIsAdding(false);
      setNewPatient({ name: '', phone: '', age: '', gender: 'Male', initialSymptoms: '', initialDiagnosis: '' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    try {
      await setDoc(doc(db, 'patients', editingPatient.id), {
        ...editingPatient,
        age: Number(editingPatient.age)
      }, { merge: true });
      setEditingPatient(null);
    } catch (e) {
      console.error(e);
      alert("Failed to update patient information.");
    }
  };

  const filtered = patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || p.phone.includes(search));

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-4"
    >
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Patient Directory</h2>
          <p className="text-xs text-slate-400">Manage hospital master patient index.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-900 text-white px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 hover:bg-blue-950 shadow-sm"
        >
          <UserPlus className="w-3.5 h-3.5" />
          {isAdding ? 'Close Portal' : 'Register Patient'}
        </button>
      </div>

      {isAdding && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-white/50 p-4 border rounded shadow-inner">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input 
              placeholder="Full Name" className="text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" required
              value={newPatient.name} onChange={e => setNewPatient({...newPatient, name: e.target.value})}
            />
            <input 
              placeholder="10-Digit Phone" className="text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400" required
              value={newPatient.phone} onChange={e => setNewPatient({...newPatient, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
              maxLength={10}
            />
            <input 
              placeholder="Age" type="number" className="text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
              value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})}
            />
            <select 
              className="text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
              value={newPatient.gender} onChange={e => setNewPatient({...newPatient, gender: e.target.value as any})}
            >
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
            <div className="md:col-span-2">
              <input 
                placeholder="Chief Complaint (at registration)" className="w-full text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                value={newPatient.initialSymptoms} onChange={e => setNewPatient({...newPatient, initialSymptoms: e.target.value})}
              />
            </div>
            <div className="md:col-span-2">
              <input 
                placeholder="Initial Clinical Diagnosis" className="w-full text-xs p-2 border rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                value={newPatient.initialDiagnosis} onChange={e => setNewPatient({...newPatient, initialDiagnosis: e.target.value})}
              />
            </div>
            <div className="md:col-span-4 flex justify-end">
               <button className="bg-blue-600 text-white px-6 py-1.5 rounded text-xs font-bold uppercase tracking-widest shadow-sm">Finalize Registration</button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input 
            placeholder="Quick search..." 
            className="flex-1 text-[11px] font-medium bg-transparent outline-none py-1"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead>
              <tr className="bg-slate-100/80 text-slate-400 uppercase font-bold tracking-widest border-b">
                <th className="px-6 py-2">Patient Index</th>
                <th className="px-6 py-2">Contact</th>
                <th className="px-6 py-2">Demographics</th>
                <th className="px-6 py-2 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-2">
                    <div className="font-bold text-slate-700">{p.name}</div>
                    <div className="text-[9px] text-slate-400 uppercase">Registered: {formatDate(p.createdAt).split(',')[0]}</div>
                  </td>
                  <td className="px-6 py-2 font-mono text-slate-600">{p.phone}</td>
                  <td className="px-6 py-2">
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.gender}</span>
                    <span className="ml-1 bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{p.age}y</span>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setEditingPatient(p)}
                        className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors shadow-sm"
                        title="Edit Demographics"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onViewHistory(p)}
                        className="p-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 hover:text-slate-800 transition-colors shadow-sm"
                        title="View History"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onSelect(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-blue-700 transition-all shadow-sm active:scale-95"
                      >
                        <PlusCircle className="w-3 h-3" /> Consult
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {editingPatient && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-blue-900 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-sm tracking-wide">Update Patient Record</h3>
                <button onClick={() => setEditingPatient(null)} className="hover:bg-blue-800 p-1 rounded-full bg-blue-950 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleUpdate} className="p-6 space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical Full Name</label>
                  <input 
                    className="w-full text-xs font-bold p-2.5 border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    value={editingPatient.name} 
                    onChange={e => setEditingPatient({...editingPatient, name: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified Age</label>
                    <input 
                      type="number"
                      className="w-full text-xs font-bold p-2.5 border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      value={editingPatient.age} 
                      onChange={e => setEditingPatient({...editingPatient, age: e.target.value as any})}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gender Identity</label>
                    <select 
                      className="w-full text-xs font-bold p-2.5 border rounded bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                      value={editingPatient.gender} 
                      onChange={e => setEditingPatient({...editingPatient, gender: e.target.value as any})}
                      required
                    >
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5 opacity-50">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System UID (Immutable Phone)</label>
                  <input 
                    className="w-full text-xs font-mono p-2.5 border rounded bg-slate-100 cursor-not-allowed"
                    value={editingPatient.phone} 
                    disabled
                  />
                </div>
                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setEditingPatient(null)}
                    className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 rounded transition-all border"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
                  >
                    <Check className="w-3.5 h-3.5" /> Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Consultation({ initialPatient, onComplete }: { initialPatient: Patient | null, onComplete: () => void }) {
  const [patient, setPatient] = useState<Patient | null>(initialPatient);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [noiseFilterActive, setNoiseFilterActive] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedPrescription>({
    symptoms: initialPatient?.initialSymptoms || '', 
    diagnosis: initialPatient?.initialDiagnosis || '', 
    medicines: []
  });
  
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Function to cleanup audio resources
    const cleanupAudio = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setAudioLevel(0);
      setNoiseFilterActive(false);
    };

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript.trim());
        }
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'audio-capture') {
          alert("Microphone capture failed. Please ensure no other application is using the mic and permissions are granted.");
        }
        if (event.error !== 'no-speech') {
          setIsRecording(false);
          cleanupAudio();
        }
      };

      recognition.onend = () => {
        // Use a ref-based approach to check if we should restart
        if (isRecordingRef.current) {
          try { recognition.start(); } catch(e) {}
        } else {
          cleanupAudio();
        }
      };

      recognitionRef.current = recognition;
    }
    return () => {
      recognitionRef.current?.stop();
      cleanupAudio();
    };
  }, []); // Only once

  // Maintain a ref for the recording state to use in the async onend handler
  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const toggleRecording = async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimTranscript('');
    } else {
      setTranscript('');
      setInterimTranscript('');
      
      // Start noise reduction and audio level processing
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        streamRef.current = stream;
        setNoiseFilterActive(true);

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioContextRef.current = audioContext;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
          if (!isRecordingRef.current) {
            setAudioLevel(0);
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          setAudioLevel(sum / bufferLength);
          requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (e) {
        console.warn("Noise reduction constraints not fully applied:", e);
      }

      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Failed to start speech recognition:", e);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      }
    }
  };

  const handleExtract = async () => {
    if (!transcript.trim()) {
      alert("No transcript found. Please record the consultation first.");
      return;
    }
    setLoadingAI(true);
    try {
      const data = await parsePrescriptionFromVoice(transcript);
      
      setExtracted(prev => {
        // Smart Merge Logic for Medicines
        const currentMeds = [...prev.medicines];
        data.medicines.forEach(newMed => {
          const existingIdx = currentMeds.findIndex(m => m.name.toLowerCase() === newMed.name.toLowerCase());
          if (existingIdx > -1) {
            // Update existing row with new info if provided
            currentMeds[existingIdx] = { ...currentMeds[existingIdx], ...newMed };
          } else {
            // Systematic insertion of new rows
            currentMeds.push(newMed);
          }
        });

        return {
          symptoms: (data.symptoms && data.symptoms.trim() !== "" && !data.symptoms.toLowerCase().includes("no specific symptoms")) 
            ? (prev.symptoms ? `${prev.symptoms}\n${data.symptoms}` : data.symptoms) 
            : prev.symptoms,
          diagnosis: (data.diagnosis && data.diagnosis.trim() !== "" && !data.diagnosis.toLowerCase().includes("no new diagnosis"))
            ? (prev.diagnosis ? `${prev.diagnosis}\n${data.diagnosis}` : data.diagnosis)
            : prev.diagnosis,
          medicines: currentMeds
        };
      });

      alert("Clinical data extracted systematically. You can now review or add more details.");
    } catch (e) {
      console.error(e);
      alert("AI Extraction failed. Please check your transcript and try again.");
    } finally {
      setLoadingAI(false);
    }
  };

  const clearClinicalData = () => {
    if (confirm("Are you sure you want to clear all symptoms, diagnosis, and medicines?")) {
      setExtracted({ symptoms: '', diagnosis: '', medicines: [] });
      setTranscript('');
    }
  };

  const saveConsultation = async () => {
    if (!patient) return;
    if (!extracted.symptoms && !extracted.diagnosis && extracted.medicines.length === 0) {
      alert("Please extract prescription details before committing the record.");
      return;
    }
    
    try {
      if (!auth.currentUser) {
        alert("Authentication required to save records.");
        return;
      }
      const visitRef = await addDoc(collection(db, 'visits'), {
        patientPhone: patient.phone,
        date: new Date().toISOString(),
        symptoms: extracted.symptoms || 'None recorded',
        diagnosis: extracted.diagnosis || 'None recorded',
        creatorId: auth.currentUser?.uid || null
      });
      await addDoc(collection(db, 'prescriptions'), {
        visitId: visitRef.id,
        patientPhone: patient.phone,
        date: new Date().toISOString(),
        medicines: extracted.medicines,
        creatorId: auth.currentUser?.uid || null
      });
      alert("Consultation record committed successfully.");
      onComplete();
    } catch (e) {
      console.error(e);
      alert("Failed to save consultation. Check console for details.");
    }
  };

  const printPDF = () => {
    if (!patient) return;
    generateProfessionalPDF(patient, extracted);
  };

  if (!patient) return <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">Select a patient from Manage Patients to start consultation.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 border rounded shadow-sm gap-3">
        <div>
          <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Consultation Context: <span className="text-blue-700">{patient.name}</span></h2>
          <p className="text-[10px] text-slate-400 font-mono">{patient.gender}, {patient.age}y | UID: {patient.phone}</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <button onClick={printPDF} title="Print Preview" className="p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-500 shadow-sm"><Printer className="w-3.5 h-3.5" /></button>
           <button onClick={saveConsultation} className="flex-1 sm:flex-none bg-slate-700 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5 hover:bg-slate-800 transition-colors"><Save className="w-3 h-3" /> Commit Record</button>
           <button onClick={printPDF} className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-blue-700 transition-colors text-center">Prescription</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Voice Input Section */}
        <div className="col-span-12 lg:col-span-5 bg-blue-900/95 rounded border border-blue-800 p-6 text-white flex flex-col items-center justify-center relative shadow-xl overflow-hidden min-h-[460px]">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-blue-400/50" />
          
          <div className="z-10 text-center space-y-4 flex flex-col items-center w-full">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-400">Electronic Audio Capture</span>
            
            <button 
              onClick={toggleRecording}
              className={cn(
                "w-20 h-20 rounded-lg flex items-center justify-center transition-all duration-300 outline-none border-2",
                isRecording 
                  ? "bg-red-500 border-red-400 scale-105 shadow-[0_0_20px_rgba(239,68,68,0.3)]" 
                  : "bg-blue-800 border-blue-700 hover:border-blue-500 shadow-lg"
              )}
            >
              {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>
            <div className="flex items-center gap-1 h-6">
              {isRecording ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-1 bg-red-400 rounded-full animate-wave" 
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </>
              ) : null}
            </div>
            <p className={cn("text-[10px] font-bold tracking-widest uppercase", isRecording ? "text-red-300" : "text-blue-300")}>
              {isRecording ? 'Capturing Session...' : 'Ready for dictation'}
            </p>

            <div className="flex items-center gap-2 px-4 py-1.5 bg-blue-950/30 rounded-full border border-blue-400/20">
              <div className="flex items-center gap-1 group relative">
                <Activity className={cn("w-3 h-3 transition-colors", noiseFilterActive ? "text-emerald-400" : "text-blue-400")} />
                <span className="text-[8px] font-bold uppercase tracking-tighter text-blue-300/80">
                  {noiseFilterActive ? 'Noise Filter Active' : 'Standard Capture'}
                </span>
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Hardware-level noise suppression enabled
                </div>
              </div>
              <div className="w-12 h-1 bg-blue-900 rounded-full overflow-hidden relative">
                <motion.div 
                  className="h-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                  animate={{ width: `${Math.min(audioLevel * 2, 100)}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.1 }}
                />
              </div>
            </div>

            <div className="w-full h-32 bg-blue-950/50 p-4 rounded text-[11px] font-medium leading-relaxed border border-blue-800/50 overflow-y-auto custom-scrollbar">
              <span className="text-blue-100/90 italic">{transcript}</span>
              <span className="text-blue-300/60 ml-1">{interimTranscript}</span>
              {!transcript && !interimTranscript && <span className="opacity-40 italic">Audio transcript stream will hydrate here during dictation...</span>}
            </div>

            <button 
              onClick={handleExtract}
              disabled={!transcript || loadingAI}
              className="w-full py-3 bg-blue-600 text-white rounded font-bold text-xs flex items-center justify-center gap-2 hover:bg-blue-500 transition-all disabled:opacity-50 tracking-wider shadow-lg"
            >
              {loadingAI ? <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <TrendingUp className="w-4 h-4" />}
              {loadingAI ? 'PROCESSING VIA AI...' : 'ANALYZE & EXTRACT'}
            </button>
          </div>
        </div>

        {/* Structured Data Editor */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          <div className="bg-white border rounded shadow-sm p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Chief Complaints</label>
                <textarea 
                  className="w-full p-2.5 text-xs border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-400 transition-all outline-none leading-relaxed h-20"
                  value={extracted.symptoms} onChange={e => setExtracted({...extracted, symptoms: e.target.value})}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clinical Diagnosis</label>
                <textarea 
                  className="w-full p-2.5 text-xs border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-400 transition-all outline-none leading-relaxed h-20"
                  value={extracted.diagnosis} onChange={e => setExtracted({...extracted, diagnosis: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
               <div className="flex justify-between items-center border-b pb-1.5">
                 <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Therapeutic Regimen</label>
                 <div className="flex items-center gap-2">
                   <button 
                    onClick={() => setExtracted({...extracted, medicines: [...extracted.medicines, { name: '', dosage: '', frequency: '', duration: '' }]})}
                    className="text-blue-600 text-[10px] font-bold uppercase hover:underline"
                   >+ Insert Row</button>
                   <button 
                    onClick={clearClinicalData}
                    className="text-red-500 text-[10px] font-bold uppercase hover:underline border-l pl-2 border-slate-200"
                   >Clear All</button>
                 </div>
               </div>
               
               <div className="border rounded overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-slate-100 border-b hidden sm:table-header-group">
                      <tr className="text-slate-500 font-bold uppercase text-[10px]">
                        <th className="p-2">Molecule / Brand</th>
                        <th className="p-2">Dose</th>
                        <th className="p-2">Schedule</th>
                        <th className="p-2">Time</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-[10px]">
                      {extracted.medicines.map((med, idx) => (
                        <tr key={idx} className="bg-white flex flex-col sm:table-row relative border-b sm:border-0 hover:bg-slate-50 transition-colors">
                          <td className="p-1 px-3 sm:p-1.5 border-b sm:border-b-0">
                            <span className="sm:hidden text-[8px] font-bold text-slate-400 uppercase block mt-1">Molecule / Brand</span>
                            <input 
                             className="w-full p-1 border-none bg-transparent outline-none focus:bg-blue-50/50 font-bold text-slate-900" 
                             value={med.name} onChange={e => {
                               const newMeds = [...extracted.medicines];
                               newMeds[idx].name = e.target.value;
                               setExtracted({...extracted, medicines: newMeds});
                             }}
                            />
                          </td>
                          <td className="p-1 px-3 sm:p-1.5 border-b sm:border-b-0">
                            <span className="sm:hidden text-[8px] font-bold text-slate-400 uppercase block mt-1">Dose</span>
                             <input 
                             className="w-full p-1 border-none bg-transparent outline-none focus:bg-blue-50/50" 
                             value={med.dosage} onChange={e => {
                               const newMeds = [...extracted.medicines];
                               newMeds[idx].dosage = e.target.value;
                               setExtracted({...extracted, medicines: newMeds});
                             }}
                            />
                          </td>
                          <td className="p-1 px-3 sm:p-1.5 border-b sm:border-b-0">
                            <span className="sm:hidden text-[8px] font-bold text-slate-400 uppercase block mt-1">Schedule</span>
                             <input 
                             className="w-full p-1 border-none bg-transparent outline-none focus:bg-blue-50/50" 
                             value={med.frequency} onChange={e => {
                               const newMeds = [...extracted.medicines];
                               newMeds[idx].frequency = e.target.value;
                               setExtracted({...extracted, medicines: newMeds});
                             }}
                            />
                          </td>
                          <td className="p-1 px-3 sm:p-1.5 border-b sm:border-b-0">
                            <span className="sm:hidden text-[8px] font-bold text-slate-400 uppercase block mt-1">Time</span>
                             <input 
                             className="w-full p-1 border-none bg-transparent outline-none focus:bg-blue-50/50" 
                             value={med.duration} onChange={e => {
                               const newMeds = [...extracted.medicines];
                               newMeds[idx].duration = e.target.value;
                               setExtracted({...extracted, medicines: newMeds});
                             }}
                            />
                          </td>
                          <td className="p-1 px-3 sm:p-1.5 text-right sm:text-center">
                            <button 
                              onClick={() => {
                                const newMeds = [...extracted.medicines];
                                newMeds.splice(idx, 1);
                                setExtracted({...extracted, medicines: newMeds});
                              }}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors inline-flex items-center gap-1 sm:block font-bold sm:font-normal"
                              title="Remove medication"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="sm:hidden text-[9px] uppercase tracking-tighter">Remove Line</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
                 {extracted.medicines.length === 0 && <p className="text-slate-400 text-[10px] p-4 text-center italic bg-slate-50">Empty regimen. Add medication lines via button above.</p>}
               </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PatientHistory({ patient, onBack }: { patient: Patient, onBack: () => void }) {
  const [history, setHistory] = useState<{visit: Visit, prescription?: Prescription}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [patient]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const vq = query(collection(db, 'visits'), where('patientPhone', '==', patient.phone));
      const vSnapshot = await getDocs(vq);
      const visits = vSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Visit))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const pq = query(collection(db, 'prescriptions'), where('patientPhone', '==', patient.phone));
      const pSnapshot = await getDocs(pq);
      const prescriptions = pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prescription));

      const combined = visits.map(v => ({
        visit: v,
        prescription: prescriptions.find(p => p.visitId === v.id)
      }));

      setHistory(combined);
    } catch (e) {
      console.error("History fetch error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="p-2 bg-white border rounded shadow-sm hover:bg-slate-50 text-slate-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Timeline: {patient.name}</h2>
          <p className="text-xs text-slate-400 font-medium">SID: {patient.phone} | {patient.age}y {patient.gender}</p>
        </div>
      </div>

      <div className="relative border-l-2 border-slate-200 ml-4 pl-8 space-y-8 py-4">
        {loading ? (
          <div className="absolute left-0 top-0 w-full h-full flex items-center justify-center bg-white/50 z-10">
             <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Querying Audit Logs...</span>
             </div>
          </div>
        ) : history.map((item, idx) => (
          <div key={item.visit.id} className="relative">
            <div className="absolute -left-[41px] top-0 w-4 h-4 rounded-full bg-white border-4 border-blue-600 shadow-sm" />
            <div className="bg-white border rounded shadow-sm overflow-hidden transition-all hover:border-blue-200 group">
              <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> {formatDate(item.visit.date)}
                </span>
                <span className="text-[9px] font-mono text-slate-400">UID-{item.visit.id?.slice(-6).toUpperCase()}</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" /> Symptoms
                      </h4>
                      <p className="text-xs text-slate-600 leading-relaxed italic">"{item.visit.symptoms}"</p>
                    </div>
                    <div>
                      <h4 className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-1 flex items-center gap-1.5">
                        <Stethoscope className="w-3 h-3" /> Dx Impression
                      </h4>
                      <p className="text-xs font-bold text-slate-800">{item.visit.diagnosis}</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50/30 p-3 rounded border border-blue-100/50">
                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                       <Clipboard className="w-3 h-3" /> Rx Regimen
                    </h4>
                    {item.prescription ? (
                      <div className="space-y-2">
                        {item.prescription.medicines.map((m, i) => (
                          <div key={i} className="flex justify-between items-center border-b border-blue-100/50 pb-1 last:border-0">
                            <span className="text-[10px] font-bold text-blue-900">{m.name}</span>
                            <span className="text-[10px] text-blue-600">{m.dosage} | {m.frequency}</span>
                          </div>
                        ))}
                        <button 
                          onClick={() => generateProfessionalPDF(patient, { 
                            symptoms: item.visit.symptoms, 
                            diagnosis: item.visit.diagnosis, 
                            medicines: item.prescription?.medicines || [] 
                          })}
                          className="w-full mt-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-100 rounded transition-colors border border-blue-200 border-dashed"
                        >
                          Download Script PDF
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">No medication recorded for this visit.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {!loading && history.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs italic">No prior clinical history found for this patient profile.</div>
        )}
      </div>
    </motion.div>
  );
}

function VisitHistory() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchVisits();
  }, []);

  const fetchVisits = async () => {
    const q = query(collection(db, 'visits'), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    setVisits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Visit)));
  };

  const filtered = visits.filter(v => v.patientPhone.includes(search));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Clinical Audit Trail</h2>
        <p className="text-xs text-slate-400">Verifiable visit logs and diagnostic history.</p>
      </div>

      <div className="bg-white border rounded shadow-sm px-4 py-2 flex items-center gap-3">
        <Search className="w-3.5 h-3.5 text-slate-400" />
        <input 
          placeholder="Filter by SID/Phone..." className="flex-1 outline-none text-[11px] font-medium" 
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map(visit => (
          <div key={visit.id} className="bg-white p-4 border rounded shadow-sm flex items-start gap-4 transition-all hover:border-blue-200">
            <div className="p-2.5 bg-blue-50/50 rounded border border-blue-100">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-800">Record #{visit.patientPhone}</h4>
                <div className="px-2 py-0.5 bg-slate-100 rounded text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                  {formatDate(visit.date)}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div className="border-l-2 border-slate-200 pl-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Symptoms</span>
                  <p className="text-slate-600 line-clamp-2">{visit.symptoms}</p>
                </div>
                <div className="border-l-2 border-blue-200 pl-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400 block mb-1">Diagnosis</span>
                  <p className="text-slate-600 line-clamp-2">{visit.diagnosis}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-20 text-slate-400 text-xs italic">No clinical records found.</div>}
      </div>
    </motion.div>
  );
}

function HospitalChat() {
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Welcome to Kalyani AI Support. How can I assist you with hospital logistics or scheduling today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input || loading) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const resp = await hospitalChatbot(userMsg);
      setMessages(prev => [...prev, { role: 'bot', text: resp }]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col space-y-4 max-w-xl mx-auto border bg-white rounded shadow-sm overflow-hidden">
      <div className="bg-blue-900 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-800 rounded flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-blue-300" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider">Kalyani Assistant v1.0</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[9px] uppercase font-bold text-blue-300 tracking-widest">Active System</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 p-4 custom-scrollbar bg-slate-50/50">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "max-w-[85%] p-3 rounded text-[11px] leading-relaxed shadow-sm", 
            m.role === 'user' 
              ? "ml-auto bg-blue-600 text-white font-medium" 
              : "bg-white border text-slate-700 font-medium"
          )}>
            {m.text}
          </div>
        ))}
        {loading && <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">● LLM INFERENCE IN PROGRESS...</div>}
      </div>

      <div className="p-3 bg-white border-t flex gap-2">
        <input 
          placeholder="Enter query (e.g. Hospital timings...)" 
          className="flex-1 outline-none text-[11px] font-medium p-2 border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500" 
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} className="bg-blue-900 text-white p-2 rounded hover:bg-black transition-colors shrink-0">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
