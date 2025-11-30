import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Lead, LeadStatus, User } from '../types';
import { Users, LayoutDashboard, BrainCircuit, ChevronLeft, ChevronRight, Shield, DollarSign, Percent, CheckCircle, XCircle, Calendar, Edit, Check } from './Icons';

interface DashboardProps {
  newLeadsData: Lead[]; 
  renewalLeadsData: Lead[]; 
  manualRenewalTotal: number;
  onUpdateRenewalTotal: (val: number) => void;
  currentUser: User | null;
}

type Section = 'NEW' | 'RENEWAL';

interface Metrics {
  total: number;
  conversionRate: number;
  sales: number;
  lost: number;
  inContact: number;
  noContact: number;
  portoCount: number;
  azulCount: number;
  itauCount: number;
  othersCount: number;
  totalPremium: number;
  avgCommission: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ newLeadsData, renewalLeadsData, manualRenewalTotal, onUpdateRenewalTotal, currentUser }) => {
  const [section, setSection] = useState<Section>('NEW');
  // Filtro de Data: Padrão Mês Atual (YYYY-MM)
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 7));
  
  // State for Editing Renewal Total
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [tempTotal, setTempTotal] = useState('');

  // Lock Sections based on User Role
  useEffect(() => {
    if (currentUser) {
        if (!currentUser.isAdmin && !currentUser.isRenovations) {
            // Usuario Comum -> Apenas Novo
            setSection('NEW');
        } else if (!currentUser.isAdmin && currentUser.isRenovations) {
            // Usuario Renovações -> Apenas Renovações
            setSection('RENEWAL');
        }
    }
  }, [currentUser]);

  const isAdmin = currentUser?.isAdmin;

  // Filtragem de dados para o usuário atual
  const userFilter = (lead: Lead) => {
    if (!currentUser) return false;
    // Admin vê tudo (Global)
    if (currentUser.isAdmin) return true;
    
    // Usuários comuns/renovação veem apenas seus leads
    return lead.assignedTo === currentUser.name;
  };

  // Lógica de Filtro de Data
  const dateFilter = (lead: Lead) => {
      if (!filterDate) return true;
      if (section === 'NEW') {
          // Para Leads Novos: Filtra rigorosamente pela data de criação
          return lead.createdAt && lead.createdAt.startsWith(filterDate);
      } else {
          // Para Renovações: Filtra pelo Fim de Vigência (Mês de Renovação)
          return lead.dealInfo?.endDate && lead.dealInfo.endDate.startsWith(filterDate);
      }
  };

  const filteredNewLeads = newLeadsData.filter(userFilter).filter(l => section === 'NEW' ? dateFilter(l) : true);
  const filteredRenewalLeads = renewalLeadsData.filter(userFilter).filter(l => section === 'RENEWAL' ? dateFilter(l) : true);

  const calculateMetrics = (subset: Lead[], isRenewalSection: boolean): Metrics => {
    // Total agora é baseado na contagem filtrada
    // POREM, se for Renovações e ADMIN, usa o Total Manual para calculo da meta/conversão global
    let total = subset.length;
    
    if (isRenewalSection && isAdmin) {
        total = manualRenewalTotal;
    }
    
    const closedDeals = subset.filter(l => l.status === LeadStatus.CLOSED);
    const sales = closedDeals.length;
    const lost = subset.filter(l => l.status === LeadStatus.LOST).length;
    const inContact = subset.filter(l => l.status === LeadStatus.IN_CONTACT).length;
    const noContact = subset.filter(l => l.status === LeadStatus.NO_CONTACT).length;
    
    const conversionRate = total > 0 ? (sales / total) * 100 : 0;

    let totalPremium = 0;
    let totalCommission = 0;
    let portoCount = 0;
    let azulCount = 0;
    let itauCount = 0;
    let othersCount = 0;

    closedDeals.forEach(lead => {
        if (lead.dealInfo) {
            totalPremium += lead.dealInfo.netPremium;
            totalCommission += lead.dealInfo.commission;

            const insurer = (lead.dealInfo.insurer || '').toLowerCase();
            
            if (insurer.includes('porto')) portoCount++;
            else if (insurer.includes('azul')) azulCount++;
            else if (insurer.includes('itau') || insurer.includes('itaú')) itauCount++;
            else othersCount++;
        }
    });

    const avgCommission = sales > 0 ? totalCommission / sales : 0;

    return {
        total,
        conversionRate,
        sales,
        lost,
        inContact,
        noContact,
        portoCount,
        azulCount,
        itauCount,
        othersCount,
        totalPremium,
        avgCommission
    };
  };

  const metrics = section === 'NEW' 
    ? calculateMetrics(filteredNewLeads, false) 
    : calculateMetrics(filteredRenewalLeads, true);

  const pieData = [
    { name: 'Renovados', value: metrics.sales, color: '#16a34a' }, 
    { name: 'Perdidos', value: metrics.lost, color: '#dc2626' }, 
    { name: 'Pendentes', value: Math.max(0, metrics.total - metrics.sales - metrics.lost), color: '#e5e7eb' }, 
  ];

  const handleSaveTotal = () => {
     const val = parseInt(tempTotal);
     if (!isNaN(val)) {
         onUpdateRenewalTotal(val);
         setIsEditingTotal(false);
     }
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      
      {/* Header with Toggle */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
         <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-600" />
            Dashboard ({isAdmin ? 'Global' : currentUser?.name})
         </h1>
         
         <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1">
                 <Calendar className="w-4 h-4 text-gray-500" />
                 <input 
                    type="month" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-sm font-medium text-gray-700 outline-none bg-transparent cursor-pointer"
                 />
             </div>

             <div className="flex items-center gap-4 bg-gray-50 rounded-lg p-1 border border-gray-200">
                 {isAdmin && (
                    <button 
                        onClick={() => setSection(section === 'NEW' ? 'RENEWAL' : 'NEW')}
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                 )}
                 <span className="font-bold text-sm text-gray-700 w-32 text-center uppercase tracking-wide">
                    {section === 'NEW' ? 'Seguro Novo' : 'Renovações'}
                 </span>
                 {isAdmin && (
                    <button 
                        onClick={() => setSection(section === 'NEW' ? 'RENEWAL' : 'NEW')}
                        className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                 )}
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {/* KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="flex justify-between items-start z-10 relative">
                    <div className="w-full">
                        <p className="text-sm text-gray-500 font-bold uppercase mb-1">
                            {section === 'NEW' ? (isAdmin ? 'Total Leads (Criados)' : 'Meus Leads (Criados)') : (isAdmin ? 'Total Renovações' : 'Minhas Renovações')}
                        </p>
                        
                        {/* Se for Renovações E Admin, mostra o total editável. Se não, mostra o total calculado */}
                        {section === 'RENEWAL' && isAdmin ? (
                            <div className="flex items-center gap-2">
                                {isEditingTotal ? (
                                    <div className="flex items-center gap-1">
                                        <input 
                                            type="number" 
                                            value={tempTotal} 
                                            onChange={e => setTempTotal(e.target.value)}
                                            className="w-24 text-2xl font-extrabold text-gray-900 border-b-2 border-indigo-500 outline-none"
                                            autoFocus
                                        />
                                        <button onClick={handleSaveTotal} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200"><Check className="w-4 h-4"/></button>
                                        <button onClick={() => setIsEditingTotal(false)} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200"><XCircle className="w-4 h-4"/></button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 group">
                                        <p className="text-3xl font-extrabold text-gray-900">{manualRenewalTotal}</p>
                                        <button 
                                            onClick={() => { setTempTotal(manualRenewalTotal.toString()); setIsEditingTotal(true); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-indigo-600"
                                            title="Editar Total Manual"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-3xl font-extrabold text-gray-900">{metrics.total}</p>
                        )}
                    </div>
                    
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 ml-2">
                        <Users className="w-6 h-6" />
                    </div>
                </div>
                
                {section === 'RENEWAL' ? (
                     <div className="mt-4 h-32 flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={25}
                                    outerRadius={40}
                                    paddingAngle={2}
                                    dataKey="value"
                                    startAngle={90}
                                    endAngle={-270}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold text-gray-600">{metrics.conversionRate.toFixed(0)}%</span>
                        </div>
                        <p className="absolute bottom-0 text-[10px] text-gray-400 font-medium">Taxa de Renovação</p>
                     </div>
                ) : (
                    <div className="mt-4">
                        <div className="w-full bg-gray-100 rounded-full h-2 mb-1">
                            <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${metrics.conversionRate}%` }}></div>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                            Taxa de Conversão: <span className="text-indigo-600 font-bold">{metrics.conversionRate.toFixed(1)}%</span>
                        </p>
                    </div>
                )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                 <div className="space-y-4">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-green-50 text-green-600 rounded-lg border border-green-100">
                                <CheckCircle className="w-5 h-5" />
                             </div>
                             <div>
                                 <p className="text-xs text-gray-500 font-bold uppercase">
                                    {section === 'NEW' ? 'Vendas' : 'Renovados'}
                                 </p>
                                 <p className="text-2xl font-bold text-green-700">{metrics.sales}</p>
                             </div>
                         </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                         <div className="flex items-center gap-3">
                             <div className="p-2 bg-red-50 text-red-600 rounded-lg border border-red-100">
                                <XCircle className="w-5 h-5" />
                             </div>
                             <div>
                                 <p className="text-xs text-gray-500 font-bold uppercase">
                                     {section === 'NEW' ? 'Perdidos' : 'Não Renovados'}
                                 </p>
                                 <p className="text-2xl font-bold text-red-700">{metrics.lost}</p>
                             </div>
                         </div>
                    </div>
                 </div>
            </div>

            {section === 'NEW' && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between">
                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                             <div>
                                 <p className="text-xs text-gray-500 font-bold uppercase mb-1">Em Contato</p>
                                 <p className="text-2xl font-bold text-yellow-600">{metrics.inContact}</p>
                             </div>
                             <div className="p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                                 <BrainCircuit className="w-5 h-5" />
                             </div>
                        </div>
                        <div className="border-t border-gray-50 pt-4">
                             <p className="text-xs text-gray-500 font-bold uppercase mb-1">Sem Contato</p>
                             <p className="text-2xl font-bold text-gray-400">{metrics.noContact}</p>
                        </div>
                     </div>
                </div>
            )}
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            Performance por Seguradora
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-col items-center">
                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Porto Seguro</span>
                <span className="text-2xl font-bold text-blue-700">{metrics.portoCount}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-cyan-100 shadow-sm flex flex-col items-center">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">Azul Seguros</span>
                <span className="text-2xl font-bold text-cyan-700">{metrics.azulCount}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex flex-col items-center">
                <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">Itaú Seguros</span>
                <span className="text-2xl font-bold text-orange-700">{metrics.itauCount}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Demais</span>
                <span className="text-2xl font-bold text-gray-700">{metrics.othersCount}</span>
            </div>
        </div>

        <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gray-400" />
            Financeiro
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-green-100 text-green-600 rounded-full">
                    <DollarSign className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Total de Prêmio Líquido</p>
                    <p className="text-2xl font-extrabold text-gray-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalPremium)}
                    </p>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-full">
                    <Percent className="w-8 h-8" />
                </div>
                <div>
                    <p className="text-xs text-gray-500 font-bold uppercase mb-1">Média de Comissão</p>
                    <p className="text-2xl font-extrabold text-gray-900">{metrics.avgCommission.toFixed(1)}%</p>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
