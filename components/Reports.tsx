import React, { useMemo, useState } from 'react';
import { Lead, LeadStatus } from '../types';
import { FileBarChart2, DollarSign, Shield, Calendar, Search, CheckCircle, ChevronLeft, ChevronRight, Percent, Plus, Download, UserCheck, FileText, Check } from './Icons';

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

  // Estados para o Modal de Parcelamento Manual da Comissão
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);
  const [selectedLeadForInstallments, setSelectedLeadForInstallments] = useState<Lead | null>(null);
  const [customInstallmentValue, setCustomInstallmentValue] = useState(1);

  // Estados para o Modal CPG
  const [isCPGModalOpen, setIsCPGModalOpen] = useState(false);
  const [selectedLeadForCPG, setSelectedLeadForCPG] = useState<Lead | null>(null);
  const [cpgType, setCpgType] = useState<'A_VISTA' | 'PARCELADO'>('A_VISTA');
  const [cpgInstallments, setCpgInstallments] = useState(1);

  // Estados para o Modal de Pagamento de Parcela (PG X/Y)
  const [isPayInstallmentModalOpen, setIsPayInstallmentModalOpen] = useState(false);
  const [selectedLeadForPayInstallment, setSelectedLeadForPayInstallment] = useState<any>(null);

  // Estados para o Modal de PDF
  const [isPDFModalOpen, setIsPDFModalOpen] = useState(false);
  const [selectedUserForPDF, setSelectedUserForPDF] = useState('');

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

  const getInstallmentsNum = (str?: string) => {
    if (!str) return 1;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[0]) : 1;
  };

  const calculateCommissionRules = (netPremium: number, commissionPct: number, paymentMethod: string, installmentsStr: string, isPaid?: boolean, hasPortoCard?: boolean, customInstallments?: number, isCPPaid?: boolean, isFirstInstallment: boolean = false) => {
      const premium = netPremium || 0;
      const commPct = commissionPct || 0;
      const baseValue = premium * (commPct / 100);

      const inst = getInstallmentsNum(installmentsStr);
      const method = (paymentMethod || '').toUpperCase();
      
      let installmentsCount = 1;

      if (customInstallments && customInstallments > 0) {
          installmentsCount = customInstallments;
      } 
      else if (!isPaid) {
          if (method.includes('CARTÃO PORTO') || method.includes('CP')) {
              installmentsCount = 1;
          } else if (method.includes('CRÉDITO') || method.includes('CREDITO') || method === 'CC') {
              installmentsCount = inst >= 7 ? inst : 1;
          } else if (method.includes('DÉBITO') || method.includes('DEBITO')) {
              installmentsCount = inst >= 5 ? inst : 1;
          } else if (method.includes('BOLETO')) {
              installmentsCount = inst >= 4 ? inst : 1;
          }
      }

      const monthlyCommBase = baseValue / installmentsCount;
      const finalBaseWithTax = monthlyCommBase * 0.85;
      const bonusPortion = hasPortoCard ? (51 / installmentsCount) : 0;
      
      const totalMonthlyValue = finalBaseWithTax + bonusPortion;

      let pendingValue = 0;
      
      if (isPaid) {
          pendingValue += 0;
      } else if (customInstallments && customInstallments > 0) {
          if (!isFirstInstallment) {
              pendingValue += finalBaseWithTax;
          }
      } else {
          pendingValue += finalBaseWithTax;
      }

      if (hasPortoCard && !isCPPaid) {
          pendingValue += bonusPortion;
      }
      
      return { 
        baseValue: baseValue + (hasPortoCard ? 51 : 0),
        finalValue: totalMonthlyValue, 
        basePortion: finalBaseWithTax,
        bonusPortion: bonusPortion,
        pendingValue: pendingValue,
        installmentsCount: installmentsCount 
      };
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

    const [filterYear, filterMonth] = filterDate.split('-').map(Number);

    uniqueLeads.forEach(lead => {
        if (lead.status === LeadStatus.CLOSED && lead.dealInfo) {
            const startDateStr = lead.dealInfo.startDate;
            if (!startDateStr) return;

            let normalizedStart = startDateStr;
            if (startDateStr.includes('/')) {
                 const [d, m, y] = startDateStr.split('/');
                 normalizedStart = `${y}-${m}-${d}`;
            }
            
            const [startYear, startMonth] = normalizedStart.split('-').map(Number);
            const monthDiff = (filterYear - startYear) * 12 + (filterMonth - startMonth);
            const isFirstMonth = monthDiff === 0;

            const currentPremium = lead.dealInfo.newNetPremium || lead.dealInfo.netPremium || 0;

            const { finalValue, pendingValue, installmentsCount, basePortion, bonusPortion } = calculateCommissionRules(
                currentPremium, 
                lead.dealInfo.commission, 
                lead.dealInfo.paymentMethod, 
                lead.dealInfo.installments,
                lead.commissionPaid,
                lead.cartaoPortoNovo,
                lead.commissionInstallmentPlan ? lead.commissionCustomInstallments : undefined,
                lead.commissionCP,
                isFirstMonth
            );

            let isVisibleInMonth = false;
            if (lead.commissionCPG) {
                if (lead.commissionCPGType === 'A_VISTA') {
                    isVisibleInMonth = (monthDiff === 0);
                } else if (lead.commissionCPGType === 'PARCELADO') {
                    const cpgLimit = lead.commissionCPGInstallments || 1;
                    isVisibleInMonth = (monthDiff >= 0 && monthDiff < cpgLimit);
                }
            } else {
                isVisibleInMonth = (monthDiff >= 0 && monthDiff < installmentsCount);
            }

            if (isVisibleInMonth) {
                 items.push({
                     id: lead.id,
                     type: 'SALE',
                     subtype: lead.insuranceType || 'Novo',
                     leadName: lead.name,
                     insurer: lead.dealInfo.insurer,
                     netPremium: currentPremium,
                     commissionPct: lead.dealInfo.commission,
                     installments: lead.dealInfo.installments,
                     paymentMethod: lead.dealInfo.paymentMethod,
                     startDate: lead.dealInfo.startDate,
                     collaborator: lead.assignedTo || 'Não informado',
                     isFirstMonth,
                     currentInstallment: monthDiff + 1,
                     totalInstallments: installmentsCount,
                     monthlyCommission: finalValue,
                     basePortion: basePortion,
                     bonusPortion: bonusPortion,
                     pendingCommission: pendingValue,
                     hasPortoCard: !!lead.cartaoPortoNovo,
                     commissionCPG: lead.commissionCPG,
                     commissionCPGType: lead.commissionCPGType,
                     commissionCPGInstallments: lead.commissionCPGInstallments,
                     monthDiff: monthDiff
                 });
            }
        }
    });
    
    return items.sort((a, b) => {
        const dateA = a.startDate.includes('/') ? a.startDate.split('/').reverse().join('') : a.startDate;
        const dateB = b.startDate.includes('/') ? b.startDate.split('/').reverse().join('') : b.startDate;
        return dateA.localeCompare(dateB);
    });
  }, [leads, renewed, renewals, filterDate]);

  const metricsGeneral = useMemo(() => {
    const data = {
        general: { premium: 0, commission: 0, count: 0, commPctSum: 0, pending: 0 },
        new: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
        renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0 }
    };

    allMonthlyItems.forEach(item => {
        data.general.commission += item.monthlyCommission;
        data.general.pending += item.pendingCommission;

        if (item.isFirstMonth) {
            data.general.premium += item.netPremium || 0;
            data.general.count++;
            data.general.commPctSum += item.commissionPct || 0;
        }

        if (item.subtype === 'Renovação Primme') {
            data.renewal.commission += item.monthlyCommission;
            if (item.isFirstMonth) {
                data.renewal.premium += item.netPremium || 0;
                data.renewal.count++;
                data.renewal.commPctSum += item.commissionPct || 0;
            }
        } else {
            data.new.commission += item.monthlyCommission;
            if (item.isFirstMonth) {
                data.new.premium += item.netPremium || 0;
                data.new.count++;
                data.new.commPctSum += item.commissionPct || 0;
            }
        }
    });
    return data;
  }, [allMonthlyItems]);

  const formatMoney = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatNumber = (val: number) => val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getAvg = (val: number, count: number) => count > 0 ? val / count : 0;

  const collaborators = useMemo(() => {
    return Array.from(new Set<string>(allMonthlyItems.map(i => String(i.collaborator)))).sort();
  }, [allMonthlyItems]);

  const handleDownloadExcel = () => {
    const xmlHeader = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
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

    const createWorksheetXML = (name: string, items: any[], metrics: any, showDetailed: boolean = false, tierMultiplier: number = 1) => {
      const isGeneral = name === 'GERAL';
      let sheet = `<Worksheet ss:Name="${name.substring(0, 31).replace(/[\[\]\*\?\/\\]/g, '')}">
      <Table ss:ExpandedColumnCount="13">
       <Column ss:Width="40"/>
       <Column ss:Width="100"/>
       <Column ss:Width="100"/>
       <Column ss:Width="200"/>
       <Column ss:Width="150"/>
       <Column ss:Width="90"/>
       <Column ss:Width="60"/>
       <Column ss:Width="110"/>
       <Column ss:Width="90"/>
       <Column ss:Width="40"/>
       <Column ss:Width="120"/>
       <Column ss:Width="60"/>
       <Column ss:Width="120"/>
       
       <Row ss:Height="25">
        <Cell ss:MergeAcross="12" ss:StyleID="headerMain"><Data ss:Type="String">RELATÓRIO DE PRODUÇÃO - ${filterDate} ${name !== 'GERAL' ? `(${name}) [TIER: ${(tierMultiplier*100).toFixed(0)}%]` : ''}</Data></Cell>
       </Row>
       <Row ss:Index="3">
        <Cell ss:MergeAcross="12" ss:StyleID="headerSection"><Data ss:Type="String">RESUMO GERAL</Data></Cell>
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
        <Cell ss:MergeAcross="12" ss:StyleID="headerSection"><Data ss:Type="String">SEGURO NOVO</Data></Cell>
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
        <Cell ss:MergeAcross="12" ss:StyleID="headerSection"><Data ss:Type="String">RENOVAÇÕES PRIMME</Data></Cell>
       </Row>
       <Row>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">PRÊMIO LÍQUIDO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.renewal.premium)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(metrics.renewal.commission)}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">TICKET MÉDIO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(getAvg(metrics.renewal.premium, metrics.renewal.count))}</Data></Cell>
        <Cell ss:MergeAcross="1" ss:StyleID="cellBold"><Data ss:Type="String">MÉDIA COMISSÃO</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${getAvg(metricsGeneral.renewal.commPctSum, metricsGeneral.renewal.count).toFixed(2)}%</Data></Cell>
       </Row>`;
      }

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
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Comissão Relatório</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Parcela</Data></Cell>
        <Cell ss:StyleID="headerMain"><Data ss:Type="String">Colaborador</Data></Cell>
       </Row>`;

      items.forEach(item => {
        const bonusPortion = item.hasPortoCard ? (51 / item.totalInstallments) : 0;
        let baseCommValue = item.monthlyCommission - bonusPortion;
        
        if (!isGeneral) {
            baseCommValue *= tierMultiplier;
        }

        let displayCommStr = formatMoney(baseCommValue);
        if (isGeneral && item.hasPortoCard) {
            displayCommStr += ` + ${formatNumber(bonusPortion)}`;
        }

        const displayBaseCommissionValue = (item.netPremium * (item.commissionPct / 100)) + (isGeneral && item.hasPortoCard && item.isFirstMonth ? 51 : 0);

        sheet += `<Row>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.id}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatDisplayDate(item.startDate)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.subtype}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.leadName.toUpperCase()}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.insurer}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.isFirstMonth ? formatMoney(item.netPremium) : 'R$ 0,00'}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.commissionPct.toFixed(2)}%</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${formatMoney(displayBaseCommissionValue)}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.paymentMethod}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.installments}</Data></Cell>
        <Cell ss:StyleID="cellGreen"><Data ss:Type="String">${displayCommStr}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.currentInstallment}/${item.totalInstallments}</Data></Cell>
        <Cell ss:StyleID="cellNormal"><Data ss:Type="String">${item.collaborator}</Data></Cell>
       </Row>`;
      });

      sheet += `</Table></Worksheet>`;
      return sheet;
    };
    
    const calculateMetricsSubset = (subset: any[], isGeneral: boolean, tierMultiplier: number = 1) => {
      const data = {
          general: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
          new: { premium: 0, commission: 0, count: 0, commPctSum: 0 },
          renewal: { premium: 0, commission: 0, count: 0, commPctSum: 0 }
      };
      subset.forEach(item => {
          const bonusPortion = item.hasPortoCard ? (51 / item.totalInstallments) : 0;
          let commissionVal = item.monthlyCommission - bonusPortion;
          
          if (!isGeneral) {
              commissionVal *= tierMultiplier;
          }

          data.general.commission += (commissionVal + (isGeneral ? bonusPortion : 0));
          if (item.isFirstMonth) {
              data.general.premium += item.netPremium || 0;
              data.general.count++;
              data.general.commPctSum += item.commissionPct || 0;
          }
          if (item.subtype === 'Renovação Primme') {
              data.renewal.commission += (commissionVal + (isGeneral ? bonusPortion : 0));
              if (item.isFirstMonth) {
                  data.renewal.premium += item.netPremium || 0;
                  data.renewal.count++;
                  data.renewal.commPctSum += item.commissionPct || 0;
              }
          } else {
              data.new.commission += (commissionVal + (isGeneral ? bonusPortion : 0));
              if (item.isFirstMonth) {
                  data.new.premium += item.netPremium || 0;
                  data.new.count++;
                  data.new.commPctSum += item.commissionPct || 0;
              }
          }
      });
      return data;
    };

    let worksheets = createWorksheetXML('GERAL', allMonthlyItems, metricsGeneral, true, 1);
    
    collaborators.forEach(collab => {
      const subset = allMonthlyItems.filter(i => i.collaborator === collab);
      const salesCount = subset.filter(i => i.isFirstMonth).length;
      let multiplier = 0.10;
      if (salesCount >= 21 && salesCount <= 30) {
          multiplier = 0.15;
      } else if (salesCount >= 31) {
          multiplier = 0.20;
      }
      worksheets += createWorksheetXML(collab, subset, calculateMetricsSubset(subset, false, multiplier), false, multiplier);
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

  const toggleCheck = (lead: any, field: string) => {
      if (!onUpdateLead) return;
      
      if (field === 'commissionCPG') {
          setSelectedLeadForCPG(lead);
          setCpgType('A_VISTA');
          setCpgInstallments(1);
          setIsCPGModalOpen(true);
          return;
      }

      if (field === 'commissionInstallmentPlan' && !lead.commissionInstallmentPlan) {
          setSelectedLeadForInstallments(lead);
          setCustomInstallmentValue(1);
          setIsInstallmentModalOpen(true);
          return;
      }

      if (field === 'payInstallment') {
          setSelectedLeadForPayInstallment(lead);
          setIsPayInstallmentModalOpen(true);
          return;
      }

      const update: any = { [field]: !lead[field] };
      
      if (field === 'commissionPaid' && update[field]) {
          update.commissionInstallmentPlan = false;
          update.commissionCustomInstallments = 0;
          update.commissionPaidInstallments = 0;
          update.commissionPaidDate = new Date().toISOString();
      } else if (field === 'commissionInstallmentPlan' && !update[field]) {
          update.commissionCustomInstallments = 0;
          update.commissionInstallmentDate = null;
          update.commissionPaidInstallments = 0;
          update.commissionPaidDate = '';
      }

      onUpdateLead({ ...lead, ...update });
  };

  const handleConfirmPayInstallment = (isAtVista: boolean) => {
      if (!selectedLeadForPayInstallment || !onUpdateLead) return;

      const total = selectedLeadForPayInstallment.commissionCustomInstallments || 1;
      const currentInstNum = (selectedLeadForPayInstallment.parcelMonthDiff || 0) + 1;
      
      const update: any = {
          commissionPaidDate: new Date().toISOString()
      };
      
      if (isAtVista) {
          update.commissionPaid = true;
          update.commissionInstallmentPlan = false;
          update.commissionPaidInstallments = total;
      } else {
          update.commissionPaidInstallments = currentInstNum;
          if (currentInstNum >= total) {
              update.commissionPaid = true;
          }
      }

      onUpdateLead({ ...selectedLeadForPayInstallment, ...update });
      setIsPayInstallmentModalOpen(false);
      setSelectedLeadForPayInstallment(null);
  };

  const handleConfirmManualInstallments = () => {
      if (!selectedLeadForInstallments || !onUpdateLead) return;

      onUpdateLead({
          ...selectedLeadForInstallments,
          commissionInstallmentPlan: true,
          commissionPaid: false,
          commissionCustomInstallments: customInstallmentValue,
          commissionInstallmentDate: new Date().toISOString(), 
          commissionPaidInstallments: 1, // Primeira parcela paga no ato
          commissionPaidDate: new Date().toISOString()
      });

      setIsInstallmentModalOpen(false);
      setSelectedLeadForInstallments(null);
  };

  const handleConfirmCPG = () => {
      if (!selectedLeadForCPG || !onUpdateLead) return;

      onUpdateLead({
          ...selectedLeadForCPG,
          commissionCPG: true,
          commissionCPGType: cpgType,
          commissionCPGInstallments: cpgType === 'PARCELADO' ? cpgInstallments : 0
      });

      setIsCPGModalOpen(false);
      setSelectedLeadForCPG(null);
  };

  const handleDownloadPDF = () => {
      if (!selectedUserForPDF) return;
      const userItems = allMonthlyItems.filter(i => i.collaborator === selectedUserForPDF);
      const salesCount = userItems.filter(i => i.isFirstMonth).length;
      let multiplier = 0.10;
      if (salesCount >= 21 && salesCount <= 30) multiplier = 0.15;
      else if (salesCount >= 31) multiplier = 0.20;

      const totalComm = userItems.reduce((acc, item) => {
          const bonusPortion = item.hasPortoCard ? (51 / item.totalInstallments) : 0;
          return acc + ((item.monthlyCommission - bonusPortion) * multiplier);
      }, 0);

      const totalPrem = userItems.filter(i => i.isFirstMonth).reduce((acc, i) => acc + i.netPremium, 0);

      const printWindow = window.open('', '_blank');
      if (!printWindow) return;

      const htmlContent = `
        <html>
        <head>
          <title>Produção Comercial - ${selectedUserForPDF}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            h1 { color: #1e3a8a; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
            .header-info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .card { background: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; }
            .card h3 { margin: 0 0 5px; font-size: 12px; color: #6b7280; text-transform: uppercase; }
            .card p { margin: 0; font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 11px; }
            th { background: #1e3a8a; color: white; padding: 10px; text-align: left; }
            td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
            @media print { .no-print { display: none; } }
          </style>
        </head>
        <body>
          <h1>Relatório de Produção Comercial</h1>
          <div class="header-info">
            <div class="card">
              <h3>Consultor</h3>
              <p>${selectedUserForPDF}</p>
            </div>
            <div class="card">
              <h3>Período</h3>
              <p>${filterDate}</p>
            </div>
            <div class="card">
              <h3>Prêmio Líquido (Mes)</h3>
              <p>${formatMoney(totalPrem)}</p>
            </div>
            <div class="card">
              <h3>Comissão Líquida (Mes)</h3>
              <p>${formatMoney(totalComm)}</p>
            </div>
            <div class="card">
              <h3>Itens Vendidos</h3>
              <p>${salesCount}</p>
            </div>
            <div class="card">
              <h3>Escalonamento (Tier)</h3>
              <p>${(multiplier * 100).toFixed(0)}%</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Vigência</th>
                <th>Segurado</th>
                <th>Seguradora</th>
                <th>Prêmio Líq.</th>
                <th>% Com.</th>
                <th>Comissão Rel.</th>
                <th>Parcela</th>
              </tr>
            </thead>
            <tbody>
              ${userItems.map(item => {
                const bonusPortion = item.hasPortoCard ? (51 / item.totalInstallments) : 0;
                const monthlyBase = (item.monthlyCommission - bonusPortion) * multiplier;
                return `
                  <tr>
                    <td>${formatDisplayDate(item.startDate)}</td>
                    <td>${item.leadName.toUpperCase()}</td>
                    <td>${item.insurer}</td>
                    <td>${item.isFirstMonth ? formatMoney(item.netPremium) : '-'}</td>
                    <td>${item.commissionPct}%</td>
                    <td>${formatMoney(monthlyBase)}</td>
                    <td>${item.currentInstallment}/${item.totalInstallments}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; color: #9ca3af; font-size: 10px;">
            Gerado em ${new Date().toLocaleString('pt-BR')} - Grupo Primme Seguros
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      setIsPDFModalOpen(false);
  };

  const paidItems = useMemo(() => {
    const allItems = [...leads, ...renewed, ...renewals]; 
    const term = searchTermPaid.toLowerCase();
    const seenIds = new Set();
    const result: any[] = [];
    const realToday = new Date();

    const [fYear, fMonth] = filterDatePaid.split('-').map(Number);

    const uniqueLeads = allItems.filter(lead => {
        if (seenIds.has(lead.id)) return false;
        seenIds.add(lead.id);
        return true;
    });

    uniqueLeads.forEach(lead => {
        if (lead.status !== LeadStatus.CLOSED || !lead.dealInfo) return;

        const name = (lead.name || '').toLowerCase();
        const phone = (lead.phone || '');
        const matchesSearch = name.includes(term) || phone.includes(term);
        if (!matchesSearch) return;

        const isInstallment = lead.commissionInstallmentPlan;
        const paidInstCount = lead.commissionPaidInstallments || 0;
        const hasCP = lead.cartaoPortoNovo;
        const isCPPaid = lead.commissionCP;
        const totalInst = lead.commissionCustomInstallments || 1;

        // --- LÓGICA DE VISIBILIDADE PARA PARCELADOS ---
        if (isInstallment && lead.commissionInstallmentDate) {
            const activationDate = new Date(lead.commissionInstallmentDate);
            const actDay = activationDate.getDate();
            const actYear = activationDate.getFullYear();
            const actMonth = activationDate.getMonth() + 1;
            
            const parcelMonthDiff = (fYear - actYear) * 12 + (fMonth - actMonth);
            const currentInstNum = parcelMonthDiff + 1;

            // Pertence ao período filtrado? (Entre parcela 1 e totalInst)
            if (parcelMonthDiff < 0 || currentInstNum > totalInst) {
                // Caso especial bônus CP residual que pode aparecer em meses seguintes se não pago
                if (currentInstNum > totalInst && lead.commissionPaid && hasCP && !isCPPaid) {
                     const bonusValue = (51 / totalInst);
                     result.push({
                        ...lead,
                        displayType: 'CP_ONLY',
                        commissionValue: bonusValue,
                        basePortion: 0,
                        bonusPortion: bonusValue,
                        pendingValue: bonusValue,
                        installmentText: null,
                        isPaidCurrent: false
                     });
                }
                return;
            }

            // Regra do dia do mês: só aparece se hoje já for dia >= dia de ativação (trava de competência)
            if (fYear === realToday.getFullYear() && fMonth === (realToday.getMonth() + 1)) {
                if (realToday.getDate() < actDay) return;
            }

            // Determinar se esta parcela específica já foi paga
            const isPaidCurrent = paidInstCount >= currentInstNum;

            const currentPremium = lead.dealInfo.newNetPremium || lead.dealInfo.netPremium || 0;
            const { finalValue, pendingValue, basePortion, bonusPortion } = calculateCommissionRules(
                currentPremium, lead.dealInfo.commission, lead.dealInfo.paymentMethod, lead.dealInfo.installments,
                false, lead.cartaoPortoNovo, totalInst, lead.commissionCP, false
            );

            result.push({
                ...lead,
                displayType: 'INSTALLMENT',
                commissionValue: finalValue,
                basePortion,
                bonusPortion,
                pendingValue: pendingValue,
                installmentText: `${currentInstNum}/${totalInst}`,
                parcelMonthDiff: parcelMonthDiff,
                isPaidCurrent: isPaidCurrent
            });
            return;
        }

        // --- LÓGICA PADRÃO (REGULAR OU PENDENTE) ---
        const startDateStr = lead.dealInfo.startDate;
        let normalizedStart = startDateStr;
        if (startDateStr.includes('/')) {
            const [d, m, y] = startDateStr.split('/');
            normalizedStart = `${y}-${m}-${d}`;
        }
        const [startYear, startMonth] = normalizedStart.split('-').map(Number);
        const monthDiff = (fYear - startYear) * 12 + (fMonth - startMonth);

        // Se o mês filtrado for anterior ao início, ignora.
        if (monthDiff < 0) return;

        const currentPremium = lead.dealInfo.newNetPremium || lead.dealInfo.netPremium || 0;

        if (monthDiff === 0) {
            const { finalValue, pendingValue, basePortion, bonusPortion } = calculateCommissionRules(
                currentPremium, lead.dealInfo.commission, lead.dealInfo.paymentMethod, lead.dealInfo.installments,
                lead.commissionPaid, lead.cartaoPortoNovo, undefined, lead.commissionCP, true
            );
            result.push({
                ...lead,
                displayType: 'REGULAR',
                commissionValue: finalValue,
                basePortion,
                bonusPortion,
                pendingValue: pendingValue,
                installmentText: null,
                monthDiff: monthDiff,
                isPaidCurrent: !!lead.commissionPaid
            });
        }
        else {
            // Mês futuro relativo ao início
            // Se já está totalmente pago (e CP pago se houver), não mostra (já saiu da pendência).
            if (lead.commissionPaid && (!hasCP || isCPPaid)) return;

            if (lead.commissionPaid && hasCP && !isCPPaid) {
                 const bonusValue = 51; // Bônus CP residual
                 result.push({
                    ...lead,
                    displayType: 'CP_ONLY',
                    commissionValue: bonusValue,
                    basePortion: 0,
                    bonusPortion: bonusValue,
                    pendingValue: bonusValue,
                    installmentText: null,
                    monthDiff: monthDiff,
                    isPaidCurrent: false
                 });
            } else if (!lead.commissionPaid) {
                 // É uma pendência de meses anteriores (Overdue)
                 const { finalValue, pendingValue, basePortion, bonusPortion } = calculateCommissionRules(
                    currentPremium, lead.dealInfo.commission, lead.dealInfo.paymentMethod, lead.dealInfo.installments,
                    false, lead.cartaoPortoNovo, undefined, lead.commissionCP, false
                 );
                 result.push({
                    ...lead,
                    displayType: 'PENDING_PAST',
                    commissionValue: finalValue,
                    basePortion,
                    bonusPortion,
                    pendingValue: pendingValue,
                    installmentText: null,
                    monthDiff: monthDiff,
                    isPaidCurrent: false
                 });
            }
        }
    });

    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, renewed, renewals, searchTermPaid, filterDatePaid]);

  const totalPendingPaid = useMemo(() => {
    return paidItems.reduce((acc, item) => acc + (item.isPaidCurrent ? 0 : (item.pendingValue || 0)), 0);
  }, [paidItems]);

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
                        <div className="flex gap-2">
                            <button onClick={() => setIsPDFModalOpen(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md">
                                <FileText className="w-4 h-4" /> Baixar PDF
                            </button>
                            <button onClick={handleDownloadExcel} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md">
                                <Download className="w-4 h-4" /> Baixar Excel
                            </button>
                        </div>
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
               <div className="space-y-4 animate-fade-in">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-4 rounded-xl shadow-lg text-white">
                            <p className="text-xs font-medium text-rose-100 uppercase">Total de Comissão Pendente</p>
                            <p className="text-2xl font-bold mt-1">{formatMoney(totalPendingPaid)}</p>
                        </div>
                   </div>

                   <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
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
                                        <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b text-center">% Com..</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b">Comissão Liq.</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b text-center">Ações</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-blue-700 uppercase border-b text-center">Data de Pagamento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {paidItems.map((item, idx) => (
                                        <tr key={item.id + (item.displayType || 'REG') + idx} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-xs font-bold text-gray-600 whitespace-nowrap">{formatDisplayDate(item.dealInfo?.startDate)}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-gray-900">{item.name}</td>
                                            <td className="px-4 py-3 text-xs text-gray-700">{item.dealInfo?.insurer}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-gray-900">{item.displayType === 'CP_ONLY' ? 'R$ 0,00' : formatMoney(item.dealInfo?.newNetPremium || item.dealInfo?.netPremium || 0)}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-indigo-600 text-center">{item.displayType === 'CP_ONLY' ? '-' : `${item.dealInfo?.commission}%`}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-green-700 bg-green-50/50">
                                                {(item.cartaoPortoNovo && item.displayType !== 'CP_ONLY') ? (
                                                    <span className="flex items-center gap-1">
                                                        {formatMoney(item.basePortion)} 
                                                        <span className="text-[10px] text-indigo-500 font-extrabold">+ {formatNumber(item.bonusPortion)}</span>
                                                    </span>
                                                ) : (
                                                    formatMoney(item.commissionValue || 0)
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    {(item.displayType === 'REGULAR' || item.displayType === 'INSTALLMENT' || item.displayType === 'PENDING_PAST') && (
                                                        <>
                                                            {item.displayType === 'INSTALLMENT' ? (
                                                                <div className="flex items-center gap-1">
                                                                    {item.isPaidCurrent ? (
                                                                        <span className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all bg-green-600 text-white border-green-700 shadow-sm whitespace-nowrap">
                                                                            {item.installmentText} Paga <Check className="w-3 h-3" />
                                                                        </span>
                                                                    ) : (
                                                                        <button onClick={() => toggleCheck(item, 'payInstallment')} className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-sm whitespace-nowrap">
                                                                            <CheckCircle className="w-3 h-3" /> Pagar {item.installmentText}?
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => toggleCheck(item, 'commissionPaid')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${item.isPaidCurrent ? 'bg-green-600 text-white border-green-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-green-500 hover:text-green-600'}`}>
                                                                        {item.isPaidCurrent ? <><Check className="w-3 h-3" /> PAGA</> : <><CheckCircle className="w-3 h-3" /> PAGA</>}
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    {(item.displayType === 'REGULAR' || item.displayType === 'PENDING_PAST') && (
                                                        <button onClick={() => toggleCheck(item, 'commissionInstallmentPlan')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${item.commissionInstallmentPlan ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-indigo-500 hover:text-indigo-600'}`}>
                                                                <Calendar className="w-3 h-3" /> PARCELADO {item.commissionInstallmentPlan && item.commissionCustomInstallments ? `(${item.commissionCustomInstallments}x)` : ''}
                                                        </button>
                                                    )}

                                                    {(item.displayType === 'REGULAR' || item.displayType === 'CP_ONLY' || item.displayType === 'INSTALLMENT' || item.displayType === 'PENDING_PAST') && item.cartaoPortoNovo && (
                                                        <button onClick={() => toggleCheck(item, 'commissionCP')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${item.commissionCP ? 'bg-blue-600 text-white border-blue-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-blue-500 hover:text-blue-600'}`}>
                                                                <DollarSign className="w-3 h-3" /> CP
                                                        </button>
                                                    )}

                                                    <button onClick={() => toggleCheck(item, 'commissionCPG')} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold transition-all ${item.commissionCPG ? 'bg-purple-600 text-white border-purple-700' : 'bg-gray-100 text-gray-400 border-gray-200 hover:border-purple-500 hover:text-purple-600'}`}>
                                                        <UserCheck className="w-3 h-3" /> CPG {item.commissionCPG ? (item.commissionCPGType === 'PARCELADO' ? `(${item.commissionCPGInstallments}x)` : '(V)') : ''}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-center font-bold text-gray-600 whitespace-nowrap">
                                                {item.isPaidCurrent ? formatDisplayDate(item.commissionPaidDate) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {paidItems.length === 0 && (
                                        <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400 text-sm italic">Nenhum registro pendente para este período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                   </section>
               </div>
           )}
       </div>

       {/* POP-UP PAGAMENTO DE PARCELA */}
       {isPayInstallmentModalOpen && selectedLeadForPayInstallment && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" /> Confirmar Pagamento
                        </h2>
                        <button onClick={() => setIsPayInstallmentModalOpen(false)} className="hover:text-gray-200 transition-colors">✕</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            Deseja confirmar o pagamento da parcela <b>{selectedLeadForPayInstallment.installmentText}</b> do cliente <b>{selectedLeadForPayInstallment.name}</b> ou quitar o seguro à vista?
                        </p>
                    </div>
                    <div className="p-6 pt-0 flex flex-col gap-3">
                        <button 
                            onClick={() => handleConfirmPayInstallment(false)} 
                            className="w-full py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" /> Confirmar Parcela {selectedLeadForPayInstallment.installmentText}
                        </button>
                        <button 
                            onClick={() => handleConfirmPayInstallment(true)} 
                            className="w-full py-3 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                        >
                            <DollarSign className="w-4 h-4" /> Quitar À Vista (Total)
                        </button>
                        <button 
                            onClick={() => setIsPayInstallmentModalOpen(false)} 
                            className="w-full py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 font-bold text-sm transition-colors mt-2"
                        >
                            Cancelar
                        </button>
                    </div>
               </div>
           </div>
       )}

       {/* POP-UP PARA ESCOLHER PARCELAMENTO DA COMISSÃO */}
       {isInstallmentModalOpen && selectedLeadForInstallments && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-sm overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <Calendar className="w-5 h-5" /> Parcelar Comissão
                        </h2>
                        <button onClick={() => setIsInstallmentModalOpen(false)} className="hover:text-gray-200 transition-colors">✕</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            Escolha em quantas vezes a comissão do cliente <b>{selectedLeadForInstallments.name}</b> será parcelada no relatório.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número de Parcelas</label>
                            <select 
                                value={customInstallmentValue}
                                onChange={(e) => setCustomInstallmentValue(Number(e.target.value))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                    <option key={num} value={num}>{num}x</option>
                                ))}
                            </select>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="text-xs text-gray-500">
                                A comissão total estimada será dividida por <b>{customInstallmentValue}</b> e distribuída nos próximos meses subsequentes ao início da vigência.
                            </p>
                        </div>
                    </div>
                    <div className="p-6 pt-0 flex gap-3">
                        <button 
                            onClick={() => setIsInstallmentModalOpen(false)} 
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-bold text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmManualInstallments} 
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 font-bold text-sm shadow-md transition-all"
                        >
                            Confirmar
                        </button>
                    </div>
               </div>
           </div>
       )}

       {/* POP-UP CPG */}
       {isCPGModalOpen && selectedLeadForCPG && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-sm overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-purple-600 px-6 py-4 flex justify-between items-center text-white">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <UserCheck className="w-5 h-5" /> Registrar CPG
                        </h2>
                        <button onClick={() => setIsCPGModalOpen(false)} className="hover:text-gray-200 transition-colors">✕</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            Como a comissão foi paga ao consultor do cliente <b>{selectedLeadForCPG.name}</b>?
                        </p>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setCpgType('A_VISTA')}
                                className={`flex-1 py-3 rounded-lg border font-bold text-sm transition-all ${cpgType === 'A_VISTA' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                À Vista
                            </button>
                            <button 
                                onClick={() => setCpgType('PARCELADO')}
                                className={`flex-1 py-3 rounded-lg border font-bold text-sm transition-all ${cpgType === 'PARCELADO' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-500'}`}
                            >
                                Parcelado
                            </button>
                        </div>
                        
                        {cpgType === 'PARCELADO' && (
                            <div className="animate-fade-in">
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Número de Parcelas</label>
                                <select 
                                    value={cpgInstallments}
                                    onChange={(e) => setCpgInstallments(Number(e.target.value))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white cursor-pointer"
                                >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(num => (
                                        <option key={num} value={num}>{num}x</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <p className="text-[10px] text-gray-500">
                                {cpgType === 'A_VISTA' 
                                    ? "O registro será removido das abas individuais dos consultores em todos os relatórios Excel subsequentes." 
                                    : `O registro aparecerá nas abas individuais dos consultores por ${cpgInstallments} meses.`}
                            </p>
                        </div>
                    </div>
                    <div className="p-6 pt-0 flex gap-3">
                        <button 
                            onClick={() => setIsCPGModalOpen(false)} 
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-bold text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirmCPG} 
                            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 font-bold text-sm shadow-md transition-all"
                        >
                            Confirmar CPG
                        </button>
                    </div>
               </div>
           </div>
       )}

       {/* POP-UP SELECIONAR USUÁRIO PARA PDF */}
       {isPDFModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
               <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-gray-200">
                    <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-white">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Baixar PDF Comercial
                        </h2>
                        <button onClick={() => setIsPDFModalOpen(false)} className="hover:text-gray-200 transition-colors">✕</button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-600 font-medium">
                            Selecione o consultor para gerar o PDF de produção do mês <b>{filterDate}</b>.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Consultor Ativo</label>
                            <select 
                                value={selectedUserForPDF}
                                onChange={(e) => setSelectedUserForPDF(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer"
                            >
                                <option value="">-- Selecione o Usuário --</option>
                                {collaborators.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="p-6 pt-0 flex gap-3">
                        <button 
                            onClick={() => setIsPDFModalOpen(false)} 
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 font-bold text-sm transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={!selectedUserForPDF}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold text-sm shadow-md transition-all disabled:opacity-50"
                        >
                            Gerar PDF
                        </button>
                    </div>
               </div>
           </div>
       )}
    </div>
  );
};
