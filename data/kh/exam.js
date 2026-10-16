// 시험 설정 - 한국사능력검정시험 심화 (HAE)
window.EXAM={
 key:'kh', name:'한국사능력검정시험 (심화)', short:'한능검', brand:'한능검 심화 특훈', brandSub:'KOREAN HISTORY · ADVANCED',
 subj:['','한국사'], per:50, min:80, store:'passmate_kh_v1', cbtOrg:'국사편찬위원회',
 isMain:()=>true,
 setLabel:s=>s,
 mainLabel:'회차·시대별 문제', oldLabel:'', oldNote:'', hasOb:false, autoNeg:true,
 rand:{A:{t:'전체 문제',d:'77회 기출 + 시대별 문제에서 50문항',f:()=>true},G:{t:'77회 기출만',d:'실제 기출 48문항',f:q=>/기출/.test(q.set)}},
 cramSrc:[{v:'G',l:'제77회 실제 기출',f:q=>/기출/.test(q.set)}],
 statLine:Q=>`(77회 기출 ${Q.filter(q=>/기출/.test(q.set)).length} + 시대별 문제 ${Q.filter(q=>!/기출/.test(q.set)).length})`,
 pdfs:{full:{url:'pdf/khist-summary.pdf',name:'khist-summary.pdf'}}
};
