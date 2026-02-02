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
  avgTicket: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ newLeadsData, renewalLeadsData, manualRenewalTotal, onUpdateRenewalTotal, currentUser }) => {
  const [section, setSection] = useState<Section>('NEW');
  
  // Função auxiliar para obter YYYY-MM no fuso local
  const getLocalMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  const getMonthFromStr = (str?: string) => {
    if (!str) return '';
    if (str.includes('T')) {
      const d = new Date(str);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return str.slice(0, 7);
  };

  // Filtro de Data: Padrão Mês Atual (Local)
  const [filterDate, setFilterDate] = useState(getLocalMonth);
  
  const [isEditingTotal, setIsEditingTotal] = useState(false);
  const [tempTotal, setTempTotal] = useState('');

  useEffect(() => {
    if (currentUser) {
        if (!currentUser.isAdmin && !currentUser.isRenovations) {
            setSection('NEW');
        } else if (!currentUser.isAdmin && currentUser.isRenovations) {
            setSection('RENEWAL');
        }
    }
  }, [currentUser]);

  const isAdmin = currentUser?.isAdmin;

  const userFilter = (lead: Lead) => {
    if (!currentUser) return false;
    if (currentUser.isAdmin) return true;
    return lead.assignedTo === currentUser.name;
  };

  const dateFilter = (lead: Lead, isRenewalLogic: boolean) => {
      if (!filterDate) return true;
      if (!isRenewalLogic) {
          // Utiliza data de atribuição (Recebido em) como prioridade, conforme solicitado
          const dateToCompare = lead.assignedAt || lead.createdAt;
          return dateToCompare && getMonthFromStr(dateToCompare) === filterDate;
      } else {
          if (lead.status === LeadStatus.CLOSED) {
              return (lead.dealInfo?.startDate && getMonthFromStr(lead.dealInfo.startDate) === filterDate) || 
                     (lead.closedAt && getMonthFromStr(lead.closedAt) === filterDate);
          }
          return lead.dealInfo?.endDate && getMonthFromStr(lead.dealInfo.endDate) === filterDate;
      }
  };

  const filteredRenewalLeads = renewalLeadsData
    .filter(userFilter)
    .filter(l => dateFilter(l, true));

  const filteredNewLeads = newLeadsData
    .filter(userFilter)
    .filter(l => dateFilter(l, false));

  const renewalSalesSpecificCount = filteredRenewalLeads.filter(l => l.status === LeadStatus.CLOSED).length;

  const totalRenewalPotential = filteredRenewalLeads.reduce((acc, lead) => {
      const valueToUse = lead.dealInfo?.previousNetPremium || lead.dealInfo?.netPremium || 0;
      return acc + (valueToUse * 1.0738);
  }, 0);

  const calculateMetrics = (subset: Lead[], isRenewalSection: boolean): Metrics => {
    let total = subset.length;
    if (!isRenewalSection) {
        total = subset.filter(l => l.insuranceType !== 'Indicação').length;
    }
    
    let sales = subset.filter(l => l.status === LeadStatus.CLOSED).length;

    if (isRenewalSection) {
        if ((isAdmin || currentUser?.isRenovations) && manualRenewalTotal > 0) {
             total = manualRenewalTotal;
        }
        sales = renewalSalesSpecificCount;
    } else {
        sales = newLeadsData
            .filter(userFilter)
            .filter(l => l.status === LeadStatus.CLOSED && l.closedAt && getMonthFromStr(l.closedAt) === filterDate)
            .length;
    }
    
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

    let leadsForStats = subset.filter(l => l.status === LeadStatus.CLOSED);

    if (!isRenewalSection) {
        leadsForStats = newLeadsData
            .filter(userFilter)
            .filter(l => l.status === LeadStatus.CLOSED && l.closedAt && getMonthFromStr(l.closedAt) === filterDate);
    }

    leadsForStats.forEach(lead => {
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
    const avgTicket = sales > 0 ? totalPremium / sales : 0;

    return { total, conversionRate, sales, lost, inContact, noContact, portoCount, azulCount, itauCount, othersCount, totalPremium, avgCommission, avgTicket };
  };

  const metrics = section === 'NEW' 
    ? calculateMetrics(filteredNewLeads, false) 
    : calculateMetrics(filteredRenewalLeads, true);

  let pieData;

  if (section === 'RENEWAL') {
      const remaining = Math.max(0, 100 - metrics.conversionRate);
      pieData = [
          { name: 'Renovado', value: metrics.conversionRate, color: '#16a34a' },
          { name: 'Restante', value: remaining, color: '#f3f4f6' }
      ];
  } else {
      pieData = [
          { name: 'Fechados', value: metrics.sales, color: '#16a34a' }, 
          { name: 'Perdidos', value: metrics.lost, color: '#dc2626' }, 
          { name: 'Pendentes', value: Math.max(0, metrics.total - metrics.sales - metrics.lost), color: '#e5e7eb' }, 
      ];
  }

  const handleSaveTotal = () => {
     const val = parseInt(tempTotal);
     if (!isNaN(val)) {
         onUpdateRenewalTotal(val);
         setIsEditingTotal(false);
     }
  };

  return (
    <div className="space-y-3 animate-fade-in h-full flex flex-col">
      <div className="flex flex-col md:flex-row items-center justify-between bg-white p-2 rounded-lg shadow-sm border border-gray-100 gap-2">
         <h1 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600" />
            Dashboard ({isAdmin ? 'Global' : currentUser?.name})
         </h1>
         <div className="flex flex-wrap items-center gap-2">
             <div className="flex items-center gap-1 bg-white border border-gray-300 rounded px-2 py-0.5">
                 <Calendar className="w-3 h-3 text-gray-500" />
                 <input 
                    type="month" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="text-xs font-medium text-gray-700 outline-none bg-transparent cursor-pointer"
                 />
             </div>
             <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                 {isAdmin && (
                    <button onClick={() => setSection(section === 'NEW' ? 'RENEWAL' : 'NEW')} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                 )}
                 <span className="font-bold text-xs text-gray-700 w-24 text-center uppercase tracking-wide">
                    {section === 'NEW' ? 'Seguro Novo' : 'Renovações'}
                 </span>
                 {isAdmin && (
                    <button onClick={() => setSection(section === 'NEW' ? 'RENEWAL' : 'NEW')} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                 )}
             </div>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 relative overflow-hidden flex flex-col justify-between h-36">
                <div className="flex justify-between items-start z-10 relative">
                    <div className="w-full">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">
                            {section === 'NEW' ? (isAdmin ? 'Total Leads' : 'Meus Leads') : (isAdmin || currentUser?.isRenovations ? 'Total Renovações' : 'Minhas Renovações')}
                        </p>
                        {section === 'RENEWAL' && isAdmin ? (
                            <div className="flex items-center gap-1">
                                {isEditingTotal ? (
                                    <div className="flex items-center gap-1">
                                        <input type="number" value={tempTotal} onChange={e => setTempTotal(e.target.value)} className="w-16 text-xl font-extrabold text-gray-900 border-b border-indigo-500 outline-none" autoFocus />
                                        <button onClick={handleSaveTotal} className="px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700 shadow-sm">Confirmar</button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <p className="text-2xl font-extrabold text-gray-900">{manualRenewalTotal}</p>
                                        <button onClick={() => { setTempTotal(manualRenewalTotal.toString()); setIsEditingTotal(true); }} className="px-1.5 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] font-bold border border-gray-200">Alterar</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-2xl font-extrabold text-gray-900">{metrics.total}</p>
                        )}
                        {section === 'RENEWAL' && (
                            <div className="mt-2 border-t border-gray-100 pt-1">
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Total Prêmios a Renovar</p>
                                <p className="text-sm font-extrabold text-indigo-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRenewalPotential)}</p>
                            </div>
                        )}
                    </div>
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg shrink-0 ml-1">
                        <Users className="w-4 h-4" />
                    </div>
                </div>
                {section === 'NEW' && (
                    <div className="mt-2">
                        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, metrics.conversionRate)}%` }}></div>
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium">Conversão: <span className="text-indigo-600 font-bold">{metrics.conversionRate.toFixed(1)}%</span></p>
                    </div>
                )}
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between h-36">
                 <div className="space-y-2">
                    <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-green-50 text-green-600 rounded-lg border border-green-100">
                                <CheckCircle className="w-4 h-4" />
                             </div>
                             <div>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase">{section === 'NEW' ? 'Vendas' : 'Renovados'}</p>
                                 <p className="text-xl font-bold text-green-700">{metrics.sales}</p>
                             </div>
                         </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-50 pt-2">
                         <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-red-50 text-red-600 rounded-lg border border-red-100">
                                <XCircle className="w-4 h-4" />
                             </div>
                             <div>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase">{section === 'NEW' ? 'Perdidos' : 'Não Renovados'}</p>
                                 <p className="text-xl font-bold text-red-700">{metrics.lost}</p>
                             </div>
                         </div>
                    </div>
                 </div>
            </div>
            {section === 'NEW' && (
                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between h-36">
                     <div className="space-y-2">
                        <div className="flex items-center justify-between">
                             <div>
                                 <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Em Contato</p>
                                 <p className="text-xl font-bold text-yellow-600">{metrics.inContact}</p>
                             </div>
                             <div className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg">
                                 <BrainCircuit className="w-4 h-4" />
                             </div>
                        </div>
                        <div className="border-t border-gray-50 pt-2">
                             <p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Sem Contato</p>
                             <p className="text-xl font-bold text-gray-400">{metrics.noContact}</p>
                        </div>
                     </div>
                </div>
            )}
            {section === 'RENEWAL' && (
                <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center h-36 relative">
                     <p className="text-[10px] text-gray-500 font-bold uppercase absolute top-3 left-3">Taxa de Renovação</p>
                     <div className="h-full flex items-center justify-center relative pt-2">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} dataKey="value" startAngle={90} endAngle={-270} stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip cursor={false} content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0];
                                            if (data.name === 'Restante') return null;
                                            return (
                                                 <div className="bg-white p-2 border border-gray-100 shadow-sm rounded text-xs font-bold">
                                                    <span style={{ color: data.payload.fill }}>{data.name}: {data.value.toFixed(1)}%</span>
                                                 </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pt-2">
                            <span className="text-sm font-bold text-gray-600">{metrics.conversionRate.toFixed(0)}%</span>
                        </div>
                     </div>
                </div>
            )}
        </div>
        <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1"><Shield className="w-4 h-4 text-gray-400" />Seguradoras</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm flex flex-col items-center"><span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Porto</span><span className="text-lg font-bold text-blue-700">{metrics.portoCount}</span></div>
            <div className="bg-white p-2 rounded-lg border border-cyan-100 shadow-sm flex flex-col items-center"><span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider mb-0.5">Azul</span><span className="text-lg font-bold text-cyan-700">{metrics.azulCount}</span></div>
            <div className="bg-white p-2 rounded-lg border border-orange-100 shadow-sm flex flex-col items-center"><span className="text-[9px] font-bold text-orange-400 uppercase tracking-wider mb-0.5">Itaú</span><span className="text-lg font-bold text-orange-700">{metrics.itauCount}</span></div>
            <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex flex-col items-center"><span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Outras</span><span className="text-lg font-bold text-gray-700">{metrics.othersCount}</span></div>
        </div>
        <h2 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1"><DollarSign className="w-4 h-4 text-gray-400" />Financeiro</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-full"><DollarSign className="w-5 h-5" /></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Prêmio Líquido</p><p className="text-lg font-extrabold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalPremium)}</p></div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-full"><DollarSign className="w-5 h-5" /></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Ticket Médio</p><p className="text-lg font-extrabold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.avgTicket)}</p></div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-full"><Percent className="w-5 h-5" /></div>
                <div><p className="text-[10px] text-gray-500 font-bold uppercase mb-0.5">Média Comissão</p><p className="text-lg font-extrabold text-gray-900">{metrics.avgCommission.toFixed(1)}%</p></div>
            </div>
        </div>
      </div>
    </div>
  );
};
