// 시험 설정 - ADsP 데이터분석 준전문가 (HAE)
window.EXAM={
 key:'ad', name:'데이터분석 준전문가 (ADsP)', short:'ADsP', brand:'ADsP 특훈', brandSub:'DATA ANALYTICS SEMI-PROFESSIONAL',
 subj:['','데이터 이해','데이터 분석 기획','데이터 분석'], per:10, min:90, store:'passmate_ad_v1', cbtOrg:'한국데이터산업진흥원',
 isMain:()=>true,
 setLabel:s=>s,
 mainLabel:'예상문제 (자체 제작)', oldLabel:'', oldNote:'', hasOb:false, autoNeg:true,
 rand:{A:{t:'전체 예상문제',d:'과목별 10문항씩 무작위',f:()=>true}},
 cramSrc:[],
 statLine:Q=>`(예상문제 ${Q.length}개 · 실제 기출 아님)`,
 pdfs:{full:{url:'pdf/adsp-summary.pdf',name:'adsp-summary.pdf'}}
};
