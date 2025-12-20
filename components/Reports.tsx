
import React, { useMemo, useState } from 'react';
import { Lead, LeadStatus } from '../types';
import { FileBarChart2, DollarSign, Shield, Calendar, Search, CheckCircle, ChevronLeft, ChevronRight, Percent, Plus, Download } from './Icons';

interface ReportsProps {
  leads: Lead[];
  renewed: Lead[];
  renewals?: Lead[]; 
  onUpdateLead?: (lead: Lead) => void;
}

type ReportTab = 'PRODUCTION' | 'PAID_INSURANCES';

export const Reports: React.FC<ReportsProps> = ({ leads, renewed, renewals = [], onUpdateLead }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('PRODUCTION');
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 7));
  const [filterDatePaid, setFilterDatePaid] = useState(() => new Date().toISOString().slice(0, 7));
  const [searchTermPaid, setSearchTermPaid] = useState('');

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return '-';
    if (dateString.includes('/')) return dateString;
    if (dateString.includes('-')) {
        const parts = dateString.split('T')[0].split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            return `${d}/${m}/${y}`;
        }
    }
    return dateString;
  };

  const parseDateForSort = (dateStr?: string) => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) {
      const [d, m, y] = dateStr.split('/');
      return new Date(`${y}-${m}-${d}`).getTime();
    }
    return new Date(dateStr).getTime();
  };

  const getInstallments = (str?: string) => {
    if (!str) return 1;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  const calculateFinalCommission = (netPremium: number, commissionPct: number, paymentMethod: string, installmentsStr: string) => {
      const premium = netPremium || 0;
      const commPct = commissionPct || 0;
      const baseValue = premium * (commPct / 100);
      const inst = getInstallments(installmentsStr);
      let finalValue = baseValue;
      const method = (paymentMethod || '').toUpperCase();

      if (method.includes('CARTÃO PORTO') || method.includes('CP')) {
          finalValue = baseValue; 
      } else if (method.includes('CRÉDITO') || method.includes('CREDITO') || method === 'CC') {
          if (inst >= 6) finalValue = baseValue / inst;
      } else if (method.includes('DÉBITO') || method.includes('DEBITO')) {
          // Regra Débito: de 5 até 12x divide pelo número da parcela. De 1 até 4x é à vista.
          if (inst >= 5) finalValue = baseValue / inst;
      } else if (method.includes('BOLETO')) {
          if (inst >= 4) finalValue = baseValue / inst;
      }
      finalValue = finalValue * 0.85;
      return { baseValue, finalValue };
  };

  const allMonthlyItems = useMemo(() => {
    const items: any[] = [];
    const allLeads = [...leads, ...renewed, ...renewals];
    const seenIds = new Set();
    const uniqueLeads = allLeads.filter(l => {
        if (seenIds.has(l.id)) return false;
        seenIds.add(l.id);
        return true;
    });

    uniqueLeads.forEach(lead => {
        if (lead.status === LeadStatus.CLOSED && lead.dealInfo) {
            const dateToCheck = lead.dealInfo.startDate || lead.closedAt || '';
            let normalizedDate = dateToCheck;
            if (dateToCheck.includes('/')) {
                 const [d, m, y] = dateToCheck.split('/');
                 normalizedDate = `${y}-${m}-${d}`;
            }
            if (normalizedDate.startsWith(filterDate)) {
                 items.push({
                     type: 'SALE',
                     subtype: lead.insuranceType || 'Novo',
                     leadName: lead.name,
                     insurer: lead.dealInfo.insurer,
                     netPremium: lead.dealInfo.netPremium,
                     commissionPct: lead.dealInfo.commission,
                     installments: lead.dealInfo.installments,
                     paymentMethod: lead.dealInfo.paymentMethod,
                     startDate: lead.dealInfo.startDate,
                     collaborator: lead.assignedTo || 'Não informado',
                     id: lead.id
                 });
            }
        }
    });
    // Ordenação por vigência da menor para a maior
    return items.sort((a, b) => parseDateForSort(a.startDate) - parseDateForSort(b.startDate));
  }, [leads, renewed, renewals, filterDate]);

  const metricsGeneral = useMemo(() => {
    const data = {
        general: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
        new: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
        renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0 }
    };
    allMonthlyItems.forEach(item => {
        const { finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
        data.general.premium += item.netPremium || 0;
        data.general.commission += finalValue;
        data.general.count++;
        data.general.commPctSum += item.commissionPct || 0;
        if (item.subtype === 'Renovação Primme') {
            data.renewal.premium += item.netPremium || 0;
            data.renewal.commission += finalValue;
            data.renewal.count++;
            data.renewal.commPctSum += item.commissionPct || 0;
        } else {
            data.new.premium += item.netPremium || 0;
            data.new.commission += finalValue;
            data.new.count++;
            data.new.commPctSum += item.commissionPct || 0;
        }
    });
    return data;
  }, [allMonthlyItems]);

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const getAvg = (val: number, count: number) => count > 0 ? val / count : 0;

  const handleDownloadExcel = () => {
    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="headerMain">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="12" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#4472C4" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="headerSection">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="cellNormal">
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
  </Style>
  <Style ss:ID="cellBold">
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
  </Style>
  <Style ss:ID="cellGreen">
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#006100" ss:Bold="1"/>
   <Interior ss:Color="#E2EFDA" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

    const createWorksheetXML = (name: string, items: any[], metrics: any, showDetailed: boolean = false) => {
      let sheet = `<Worksheet ss:Name="${name.substring(0, 31).replace(/[\[\]\*\?\/\\]/g, '')}">
      <Table ss:ExpandedColumnCount="12">
       <Column ss:Width="40"/>
       <Column ss:Width="100"/>
       <Column ss:Width="100"/>
       <Column ss:Width="250"/>
       <Column ss:Width="150"/>
       <Column ss:Width="100"/>
       <Column ss:Width="60"/>
       <Column ss:Width="120"/>
       <Column ss:Width="100"/>
       <Column ss:Width="50"/>
       <Column ss:Width="150"/>
       <Column ss:Width="150"/>
       
       <Row ss:Height="25">
        <Cell ss:MergeAcross="11" ss:StyleID="headerMain"><Data ss:Type="String">RELATÓRIO DE PRODUÇÃO - ${filterDate} ${name !== 'GERAL' ? `(${name})` : ''}</Data></Cell>
       </Row>
       <Row ss:Index="3">
        <Cell ss:MergeAcross="11" ss:StyleID="headerSection"><Data ss:Type="String">RESUMO GERAL</Data></Cell>
       </Row>
       <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">PRÊMIO LÍQ. TOTAL</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.general.premium)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">COMISSÃO TOTAL</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.general.commission)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">ITENS PRODUZIDOS</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellNormal"><Data ss:Type="Number">${metrics.general.count}</Data></Cell>
       </Row>`;

      if (showDetailed) {
        sheet += `
       <Row ss:Index="6">
        <Cell ss:MergeAcross="11" ss:StyleID="headerSection"><Data ss:Type="String">SEGURO NOVO</Data></Cell>
       </Row>
       <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">PRÊMIO LÍQUIDO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.new.premium)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.new.commission)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">TICKET MÉDIO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(getAvg(metrics.new.premium, metrics.new.count))}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">MÉDIA COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${getAvg(metrics.new.commPctSum, metrics.new.count).toFixed(2)}%</Data></Cell>
       </Row>
       <Row ss:Index="9">
        <Cell ss:MergeAcross="11" ss:StyleID="headerSection"><Data ss:Type="String">RENOVAÇÕES PRIMME</Data></Cell>
       </Row>
       <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">PRÊMIO LÍQUIDO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.renewal.premium)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.renewal.commission)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">TICKET MÉDIO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(getAvg(metrics.renewal.premium, metrics.renewal.count))}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">MÉDIA COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${getAvg(metrics.renewal.commPctSum, metrics.renewal.count).toFixed(2)}%</Data></Cell>
       </Row>`;
      }

      // Se não for detalhado, a listagem de itens começa no Index 6, caso contrário no Index 12
      sheet += `
       <Row ss:Index="${showDetailed ? '12' : '6'}" ss:Height="20">
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">ID</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Vigência Início</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Tipo</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Segurado</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Seguradora</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Prêmio Líquido</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">% Com</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Comissão Base</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Forma Pagto</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Parc</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Comissão Final (85%)</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Colaborador</Data></Cell>
       </Row>`;

      items.forEach(item => {
        const { baseValue, finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
        sheet += `<Row>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.id}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatDisplayDate(item.startDate)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.subtype}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.leadName.toUpperCase()}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.insurer}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(item.netPremium)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.commissionPct.toFixed(2)}%</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(baseValue)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.paymentMethod}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.installments}</Data></Cell>
        <Cell ss:StyleID="cellGreen"><Data ss:Type="String">${formatMoney(finalValue)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.collaborator}</Data></Cell>
       </Row>`;
      });

      sheet += `</Table></Worksheet>`;
      return sheet;
    };

    const collaborators = Array.from(new Set(allMonthlyItems.map(i => i.collaborator))).sort();
    
    const calculateMetricsSubset = (subset: any[]) => {
      const data = {
          general: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
          new: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
          renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0 }
      };
      subset.forEach(item => {
          const { finalValue } = calculateFinalCommission(item.netPremium, item.commissionPct, item.paymentMethod, item.installments);
          data.general.premium += item.netPremium || 0;
          data.general.commission += finalValue;
          data.general.count++;
          data.general.commPctSum += item.commissionPct || 0;
          if (item.subtype === 'Renovação Primme') {
              data.renewal.premium += item.netPremium || 0;
              data.renewal.commission += finalValue;
              data.renewal.count++;
              data.renewal.commPctSum += item.commissionPct || 0;
          } else {
              data.new.premium += item.netPremium || 0;
              data.new.commission += finalValue;
              data.new.count++;
              data.new.commPctSum += item.commissionPct || 0;
          }
      });
      return data;
    };

    // Aba Geral mostra tudo (showDetailed = true)
    let worksheets = createWorksheetXML('GERAL', allMonthlyItems, metricsGeneral, true);
    
    // Abas de usuários mostram apenas o Resumo Geral (showDetailed = false)
    collaborators.forEach(collab => {
      const subset = allMonthlyItems.filter(i => i.collaborator === collab);
      worksheets += createWorksheetXML(collab, subset, calculateMetricsSubset(subset), false);
    });

    const fullXML = xmlHeader + worksheets + '</Workbook>';
    const blob = new Blob(['\ufeff', fullXML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Relatorio_Producao_${filterDate}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleCheck = (lead: Lead, field: 'commissionPaid' | 'commissionCP') => {
      if (!onUpdateLead) return;
      onUpdateLead({ ...lead, [field]: !lead[field] });
  };

  const paidItems = useMemo(() => {
    const allItems = [...leads, ...renewed]; 
    const term = searchTermPaid.toLowerCase();
    const seenIds = new Set();
    return allItems
      .filter(lead => {
        if (seenIds.has(lead.id)) return false;
        const isClosed = lead.status === LeadStatus.CLOSED && !!lead.dealInfo;
        if (!isClosed) return false;
        const name = (lead.name || '').toLowerCase();
        const phone = (lead.phone || '');
        const matchesSearch = name.includes(term) || phone.includes(term);
        const startDate = lead.dealInfo?.startDate || '';
        let normalizedDate = startDate;
        if (startDate.includes('/')) {
            const [d, m, y] = startDate.split('/');
            normalizedDate = `${y}-${m}-${d}`;
        }
        if (matchesSearch && normalizedDate.startsWith(filterDatePaid)) {
            seenIds.add(lead.id);
            return true;
        }
        return false;
      })
      .map(lead => {
          const { finalValue } = calculateFinalCommission(lead.dealInfo!.netPremium, lead.dealInfo!.commission, lead.dealInfo!.paymentMethod, lead.dealInfo!.installments);
          return {
            ...lead,
            commissionValue: finalValue,
            normalizedStartDate: lead.dealInfo?.startDate.includes('/') ? lead.dealInfo.startDate.split('/').reverse().join('-') : lead.dealInfo?.startDate || ''
          };
      })
      .sort((a, b) => a.normalizedStartDate.localeCompare(b.normalizedStartDate));
  }, [leads, renewed, searchTermPaid, filterDatePaid]);

  return (
    <div className="h-full flex flex-col animate-fade-in space-y-4">
       <div className="flex flex-col md:flex-row items-center justify-between bg-white p-3 rounded-xl border border-gray-200 shadow-sm gap-4">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-lg ${activeTab === 'PRODUCTION' ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                {activeTab === 'PRODUCTION' ? <FileBarChart2 className="w-6 h-6" /> : <DollarSign className="w-6 h-6" />}
             </div>
             <div>
                <h2 className="text-xl font-bold text-gray-800">
                    {activeTab === 'PRODUCTION' ? 'Relatórios de Produção' : 'Relatórios de Seguros Pagos'}
                </h2>
                <p className="text-xs text-gray-500">
                    {activeTab === 'PRODUCTION' ? 'Financeiro e Controle de Produção' : 'Controle de Baixa de Comissões'}
                </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
                <button onClick={() => setActiveTab(activeTab === 'PAID_INSURANCES' ? 'PRODUCTION' : 'PAID_INSURANCES')} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="font-bold text-xs text-gray-700 w-32 text-center uppercase tracking-wide">
                    {activeTab === 'PRODUCTION' ? 'Produção' : 'Seguros Pagos'}
                </span>
                <button onClick={() => setActiveTab(activeTab === 'PAID_INSURANCES' ? 'PRODUCTION' : 'PAID_INSURANCES')} className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-600">
                    <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded-lg px-3 py-1.5">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <input type="month" value={activeTab === 'PRODUCTION' ? filterDate : filterDatePaid} onChange={(e) => activeTab === 'PRODUCTION' ? setFilterDate(e.target.value) : setFilterDatePaid(e.target.value)} className="text-sm font-medium text-gray-700 outline-none bg-transparent cursor-pointer" />
              </div>
          </div>
       </div>

       <div className="flex-1 overflow-y-auto space-y-6 pb-6">
           {activeTab === 'PRODUCTION' && (
               <>
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Resumo do Período
                        </h3>
                        <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md">
                            <Download className="w-4 h-4" /> Baixar Excel
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-4 rounded-xl shadow-lg text-white">
                            <p className="text-xs font-medium text-indigo-100 uppercase">Prêmio Líquido Total</p>
                            <p className="text-2xl font-bold mt-1">{formatMoney(metricsGeneral.general.premium)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 rounded-xl shadow-lg text-white">
                            <p className="text-xs font-medium text-emerald-100 uppercase">Comissão Total (Estimada)</p>
                            <p className="text-2xl font-bold mt-1">{formatMoney(metricsGeneral.general.commission)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-center items-center">
                            <p className="text-xs font-bold text-gray-400 uppercase">Itens Produzidos</p>
                            <p className="text-3xl font-extrabold text-gray-800 mt-1">{metricsGeneral.general.count}</p>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex justify-between items-center">
                            <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                                <Plus className="w-4 h-4" /> Seguro Novo / Renovação Mercado
                            </h4>
                            <span className="bg-indigo-600 text-white text-xs font-extrabold px-2 py-1 rounded-lg">{metricsGeneral.new.count} Itens</span>
                        </div>
                        <div className="p-5 space-y-6 flex-1 overflow-x-auto">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Prêmio Líquido</p>
                                    <p className="text-sm font-bold text-gray-800">{formatMoney(metricsGeneral.new.premium)}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Comissão Estimada</p>
                                    <p className="text-sm font-bold text-emerald-600">{formatMoney(metricsGeneral.new.commission)}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Média Comissão</p>
                                    <p className="text-sm font-bold text-indigo-600">{getAvg(metricsGeneral.new.commPctSum, metricsGeneral.new.count).toFixed(1)}%</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ticket Médio</p>
                                    <p className="text-sm font-bold text-gray-700">{formatMoney(getAvg(metricsGeneral.new.premium, metricsGeneral.new.count))}</p>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
                            <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Renovação Primme
                            </h4>
                            <span className="bg-emerald-600 text-white text-xs font-extrabold px-2 py-1 rounded-lg">{metricsGeneral.renewal.count} Itens</span>
                        </div>
                        <div className="p-5 space-y-6 flex-1">
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Prêmio Líquido</p>
                                    <p className="text-sm font-bold text-gray-800">{formatMoney(metricsGeneral.renewal.premium)}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Comissão Estimada</p>
                                    <p className="text-sm font-bold text-emerald-600">{formatMoney(metricsGeneral.renewal.commission)}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Média Comissão</p>
                                    <p className="text-sm font-bold text-indigo-600">{getAvg(metricsGeneral.renewal.commPctSum, metricsGeneral.renewal.count).toFixed(1)}%</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Ticket Médio</p>
                                    <p className="text-sm font-bold text-gray-700">{formatMoney(getAvg(metricsGeneral.renewal.premium, metricsGeneral.renewal.count))}</p>
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
               </>
           )}

           {activeTab === 'PAID_INSURANCES' && (
               <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col animate-fade-in">
                   <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                       <div className="flex items-center gap-2">
                           <DollarSign className="w-5 h-5 text-blue-600" />
                           <h3 className="font-bold text-gray-800">Pesquisar Seguros Pagos</h3>
                       </div>
                       <div className="relative w-full md:w-80">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                           <input type="text" placeholder="Nome ou Telefone..." value={searchTermPaid} onChange={(e) => setSearchTermPaid(e.target.value)} className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                       </div>
                   </div>
                   <div className="overflow-x-auto">
                       <table className="w-full text-left border-collapse">
                           <thead className="bg-gray-50">
                               <tr>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Vigência</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Nome</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Seguradora</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Prêmio Líquido</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b text-center">% Com.</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Comissão Liq.</th>
                                   <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b text-center">Ações</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-100">
                               {paidItems.map(lead => (
                                   <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                                       <td className="px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">{formatDisplayDate(lead.dealInfo?.startDate)}</td>
                                       <td className="px-4 py-3 text-xs font-bold text-gray-900">{lead.name}</td>
                                       <td className="px-4 py-3 text-xs text-gray-700">{lead.dealInfo?.insurer}</td>
                                       <td className="px-4 py-3 text-xs font-bold text-gray-900">{formatMoney(lead.dealInfo?.netPremium || 0)}</td>
                                       <td className="px-4 py-3 text-xs font-bold text-indigo-600 text-center">{lead.dealInfo?.commission}%</td>
                                       <td className="px-4 py-3 text-xs font-bold text-green-700 bg-green-50/50">{formatMoney(lead.commissionValue || 0)}</td>
                                       <td className="px-4 py-3">
                                           <div className="flex items-center justify-center gap-2">
                                               <button onClick={() => toggleCheck(lead, 'commissionPaid')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${lead.commissionPaid ? 'bg-green-600 text-white border-green-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-green-500 hover:text-green-600'}`}>
                                                    <CheckCircle className="w-3 h-3" /> PAGA
                                               </button>
                                               {lead.cartaoPortoNovo && (
                                                   <button onClick={() => toggleCheck(lead, 'commissionCP')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${lead.commissionCP ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-blue-500 hover:text-blue-600'}`}>
                                                        <DollarSign className="w-3 h-3" /> CP
                                                   </button>
                                               )}
                                           </div>
                                       </td>
                                   </tr>
                               ))}
                               {paidItems.length === 0 && (
                                   <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm italic">Nenhum registro encontrado.</td></tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               </section>
           )}
       </div>
    </div>
  );
};
