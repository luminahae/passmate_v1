/* 패스메이트 카탈로그 — HAE
   diff = 난이도: level 1(쉬움)~5(매우 어려움), rates = [단계, 합격률, 기준 연도]. 2026-10 확인한 자료 기준.
   자격증 기본 정보, 공식 시험 일정(원서접수 포함), 접수 사이트.
   개인 기록은 여기 넣지 않아요. 로그인한 사람의 기록은 따로 저장돼요.
   일정 고치는 법: 아래 SCHEDULE 배열의 날짜를 바꾸면 돼요. (YYYY-MM-DD) */
window.PM_CATALOG = {
  /* 잠금 코드 — 코드 글자 대신 바꾼 값(해시)만 적어 둬요. 코드를 바꾸려면 HAE에게 새 값을 받아 바꾸기.
     admin: 관리자 코드 (모든 제한 해제, adminEmail 계정으로 로그인 + 이메일 인증된 경우에만)
     cram:  벼락치기 열기 코드 (회원만) */
  codes: { admin: "q2vguzm7ks", cram: "1etm26p98tj", adminEmail: "lumina.hae@gmail.com" },
  sites: {
    qnet: { name: "큐넷", url: "https://www.q-net.or.kr" },
    korcham: { name: "대한상공회의소 자격평가사업단", url: "https://license.korcham.net" },
    dataq: { name: "데이터자격검정", url: "https://www.dataq.or.kr" },
    history: { name: "한국사능력검정시험", url: "https://www.historyexam.go.kr" }
  },

  certs: [
    {
      id: "comp1", name: "컴퓨터활용능력 1급", short: "컴활 1급", org: "대한상공회의소", color: "#3B6FD9", site: "korcham", pack: "comp1", qn: 2321, cn: 28,
      diff: { level: 5, label: "매우 어려움", rates: [["필기", "약 26%", "2025"], ["실기", "8.8%", "2025"]], tip: "필기는 기출 반복으로 충분히 넘을 수 있어요. 진짜 고비는 실기(엑셀·액세스 실무)예요.", src: "합격률: 대한상공회의소 통계를 인용한 자료 (링커리어 정리)" },
      stages: [
        { name: "필기", subjects: ["컴퓨터 일반", "스프레드시트 일반", "데이터베이스 일반"], subjMin: 40, passMin: 60 },
        { name: "실기", subjects: ["스프레드시트 실무", "데이터베이스 실무"], subjMin: 70, passMin: 70 }
      ],
      exam: { count: 60, minutes: 60, perSubject: [20, 20, 20] }
    },
    {
      id: "arch", name: "건축기사", short: "건축기사", org: "한국산업인력공단", color: "#C2571A", site: "qnet", pack: "arch", qn: 3900, cn: 24,
      diff: { level: 4, label: "어려움", rates: [["필기", "41.8%", "2025"], ["실기", "27.0%", "2025"]], tip: "필기는 기출이 많이 반복돼요. 실기(시공 실무 서술·계산)에서 많이 떨어져요.", src: "합격률: 큐넷 연도별 통계 (인비원 정리)" },
      stages: [
        { name: "필기", subjects: ["건축계획", "건축시공", "건축구조", "건축설비", "건축관계법규"], subjMin: 40, passMin: 60 },
        { name: "실기", subjects: ["건축시공 실무"], subjMin: 0, passMin: 60 }
      ],
      exam: { count: 100, minutes: 150, perSubject: [20, 20, 20, 20, 20] }
    },
    {
      id: "adsp", name: "데이터분석 준전문가 (ADsP)", short: "ADsP", org: "한국데이터산업진흥원", color: "#1E8F7A", site: "dataq", pack: "adsp", qn: 37, cn: 12,
      diff: { level: 2, label: "쉬운 편", rates: [["시험", "약 62~68%", "2025 회차별"]], tip: "통계 기초와 R 결과 해석이 3과목(30문항)이라 여기서 점수가 갈려요.", src: "합격률: 데이터자격검정 발표·커뮤니티 집계 추정치 (윈스펙 정리)" },
      stages: [
        { name: "시험", subjects: ["데이터 이해", "데이터 분석 기획", "데이터 분석"], weights: [20, 20, 60], subjMin: 40, passMin: 60 }
      ],
      exam: { count: 50, minutes: 90, perSubject: [10, 10, 30] }
    },
    {
      id: "khist", name: "한국사능력검정시험 (심화)", short: "한능검", org: "국사편찬위원회", color: "#8A5A2B", site: "history", pack: "khist", qn: 256, cn: 10,
      diff: { level: 3, label: "보통 · 1급은 어려움", rates: [["1급 (80점↑)", "약 22%", "63~68회 평균"], ["전체 합격", "약 49~59%", "63~68회"]], tip: "3급(60점)은 기출 반복으로 충분해요. 1급은 사료 해석 문제까지 잡아야 해요.", src: "합격률: 회차별 발표 정리 (마추다 정리)" },
      stages: [
        { name: "시험", subjects: ["총점"], subjMin: 0, passMin: 60, grades: [[80, "1급"], [70, "2급"], [60, "3급"]] }
      ],
      exam: { count: 50, minutes: 80 }
    },
    {
      id: "color", name: "컬러리스트기사", short: "컬러리스트", org: "한국산업인력공단", color: "#B03A8C", site: "qnet", pack: null,
      diff: { level: 3, label: "보통", rates: [["필기", "46.4%", "2025"], ["실기", "70.5%", "2025"]], tip: "필기 이론 범위가 넓은 편이고, 실기는 색 조색·배색 연습량이 관건이에요.", src: "합격률: 큐넷 연도별 통계 (인비원 정리)" },
      stages: [
        { name: "필기", subjects: ["색채 심리·마케팅", "색채 디자인", "색채 관리", "색채 지각론", "색채 체계론"], subjMin: 40, passMin: 60 },
        { name: "실기", subjects: ["색채 계획 실무"], subjMin: 0, passMin: 60 }
      ]
    },
    {
      id: "indd", name: "산업디자인기사", short: "산업디자인", org: "한국산업인력공단", color: "#7A5AC8", site: "qnet", pack: null,
      diff: { level: 0, label: "자료 확인 필요", rates: [], tip: "최근 합격률 자료를 찾지 못했어요. 큐넷 자격검정통계에서 확인해 주세요.", src: "" },
      stages: [
        { name: "필기", subjects: [], subjMin: 40, passMin: 60 },
        { name: "실기", subjects: ["실기"], subjMin: 0, passMin: 60 }
      ],
      note: "필기 과목은 큐넷 출제기준을 보고 [자격증 설정]에서 직접 넣어 주세요."
    }
  ],

  /* 공식 일정. reg = 원서접수 [시작, 끝], exam = 시험 [시작, 끝], result = 합격 발표.
     est: true 는 아직 공고 전이라 예상만 적은 것. */
  SCHEDULE: [
    // 국가기술자격 정기 기사 (건축기사·컬러리스트기사·산업디자인기사) — 종목별 시행 회차는 큐넷에서 확인
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 1회 필기", reg: ["2026-01-12", "2026-01-15"], exam: ["2026-01-30", "2026-03-03"], result: "2026-03-11", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 1회 실기", reg: ["2026-03-23", "2026-03-26"], exam: ["2026-04-18", "2026-05-06"], result: "2026-06-12", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 2회 필기", reg: ["2026-04-20", "2026-04-23"], exam: ["2026-05-09", "2026-05-29"], result: "2026-06-10", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 2회 실기", reg: ["2026-06-22", "2026-06-25"], exam: ["2026-07-18", "2026-08-05"], result: "2026-09-11", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 3회 필기", reg: ["2026-07-20", "2026-07-23"], exam: ["2026-08-07", "2026-09-01"], result: "2026-09-09", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2026 정기 기사 3회 실기", reg: ["2026-09-21", "2026-09-28"], exam: ["2026-10-24", "2026-11-13"], result: "2026-12-18", site: "qnet" },
    { certs: ["arch", "color", "indd"], title: "2027 정기 기사 1회 필기", est: true, regText: "2027년 1월 중순 예상", examText: "2027년 1~3월 예상", sortDate: "2027-01-15", site: "qnet", note: "2027년 일정은 보통 12월에 큐넷에 공고돼요" },

    // ADsP (데이터자격검정)
    { certs: ["adsp"], title: "ADsP 제48회", reg: ["2026-01-05", "2026-01-09"], exam: ["2026-02-07", "2026-02-07"], result: "2026-03-06", site: "dataq" },
    { certs: ["adsp"], title: "ADsP 제49회", reg: ["2026-04-13", "2026-04-17"], exam: ["2026-05-17", "2026-05-17"], result: "2026-06-05", site: "dataq" },
    { certs: ["adsp"], title: "ADsP 제50회", reg: ["2026-07-06", "2026-07-10"], exam: ["2026-08-08", "2026-08-08"], result: "2026-08-28", site: "dataq" },
    { certs: ["adsp"], title: "ADsP 제51회", reg: ["2026-09-28", "2026-10-02"], exam: ["2026-10-31", "2026-10-31"], result: "2026-11-20", site: "dataq" },
    { certs: ["adsp"], title: "ADsP 2027년 첫 회차", est: true, regText: "2027년 1월 초 예상", examText: "2027년 2월 예상", sortDate: "2027-01-05", site: "dataq", note: "데이터자격검정 공고 후 확정돼요" },

    // 한국사능력검정시험 (접수는 보통 시험 약 한 달 전)
    { certs: ["khist"], title: "한능검 제77회", regText: "접수 마감", exam: ["2026-02-07", "2026-02-07"], result: "2026-02-20", site: "history" },
    { certs: ["khist"], title: "한능검 제78회 (심화만)", regText: "접수 마감", exam: ["2026-05-23", "2026-05-23"], result: "2026-06-05", site: "history" },
    { certs: ["khist"], title: "한능검 제79회", regText: "접수 마감", exam: ["2026-08-09", "2026-08-09"], result: "2026-08-21", site: "history" },
    { certs: ["khist"], title: "한능검 제80회 (심화만)", regText: "접수 마감", exam: ["2026-10-17", "2026-10-17"], result: "2026-10-30", site: "history" },
    { certs: ["khist"], title: "한능검 2027년 첫 회차", est: true, regText: "시험 약 한 달 전", examText: "2027년 2월 예상", sortDate: "2027-02-01", site: "history", note: "국사편찬위원회 공고 후 확정돼요" },

    // 컴활 1급 — 상시검정
    { certs: ["comp1"], title: "컴활 1급 필기·실기 상시검정", always: true, regText: "상시 접수 · 원하는 날짜와 시험장 선택", examText: "접수한 날짜", site: "korcham", note: "인기 시험장은 빨리 차요. 2주 전쯤 미리 잡는 걸 추천해요" }
  ]
};
