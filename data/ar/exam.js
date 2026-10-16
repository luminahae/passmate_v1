// 시험 설정 - 건축기사 필기 (HAE)
window.EXAM={
 key:'ar', name:'건축기사 필기', short:'건축기사', brand:'건축기사 필기 특훈', brandSub:'ARCHITECTURE · WRITTEN',
 subj:['','건축계획','건축시공','건축구조','건축설비','건축법규'], per:20, min:150, store:'passmate_ar_v1', cbtOrg:'한국산업인력공단',
 isMain:(s,Q)=>{const L=[...new Set(Q.map(q=>q.set))].sort().reverse().slice(0,5);return L.includes(s);},
 setLabel:s=>s,
 mainLabel:'최근 5회차', oldLabel:'전체 회차 2009~2022', oldNote:'2020년 이전 법규 문제는 지금 법과 숫자·명칭이 다를 수 있어요.', hasOb:false, autoNeg:true,
 figDir:'data/ar/fig/',
 rand:{A:{t:'전체 기출',d:'2009~2022 기출 39회',f:()=>true},R:{t:'최근 5년',d:'2018년 이후 기출',f:q=>+q.set.slice(0,4)>=2018}},
 cramSrc:[{v:'G',l:'여러 번 나온 문제 (2회 이상)',f:q=>(q.g||1)>=2},{v:'G3',l:'자주 나온 문제 (3회 이상)',f:q=>(q.g||1)>=3}],
 statLine:Q=>`(2009~2022 기출 ${new Set(Q.map(q=>q.set)).size}회)`,
 pdfs:{full:{url:'pdf/arch-summary.pdf',name:'arch-summary.pdf'}}
};
