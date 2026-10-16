# 패스메이트

자격증 합격을 같이 준비하는 공부 파트너 웹앱 · 만든이 HAE

## 기능
- 회원가입·로그인 화면 + 로그아웃(오른쪽 위 이름 버튼) + 회원 탈퇴(이력 탭): 온라인 앱 링크로 열면 내 계정 공간에 저장(다른 기기에서도 같은 기록), GitHub에서 열면 이메일·비밀번호로 가입해 로그인하고 Firebase에 저장(어느 기기에서도 같은 기록, js/firebase-config.js 설정 필요). 설정이 비어 있으면 아이디·비밀번호로 이 기기 브라우저에만 저장
- 처음 로그인하면 준비할 자격증을 고름 (컴활 1급, 건축기사, ADsP, 한능검 심화, 컬러리스트기사, 산업디자인기사, 직접 추가)
- 기출 풀기: 회차별 / 실전 모의고사(시험 시간·과목별 문항 수 그대로, 답안 표기란) / 골라 풀기(과목·안 푼 것·틀린 것), 바로 채점 또는 끝나고 채점, 과목별 점수와 합격 판정
- 요약정리: 과목별·검색·자주 나온 것만, 문제 해설에서 관련 요약 바로 보기
- 오답노트: 자동 수집, 많이 틀린 순, 메모, 다시 풀어 맞히면 극복
- 시험 일정: 공식 일정(원서접수·시험·발표) + 원서 접수 사이트 바로가기 + 내 시험 D-day
- 이력: 실제 시험 결과·최종 합격 기록, 타임라인, 이력서용 문구 복사, 백업

- 자격증별 난이도: 5단계 표시 + 최근 합격률 (js/catalog.js의 diff에서 수정)
- 왼쪽 위 로고를 누르면 홈으로

## 게스트·잠금
- 게스트: 가입 없이 둘러보기 (이 기기에만 임시 저장, 핵심요약·벼락치기 X)
- 벼락치기: 코드를 넣어야 열림 (회원)
- 관리자 코드: 모든 제한 해제, 관리자 이메일(js/catalog.js의 codes.adminEmail) 계정 + 이메일 인증된 경우만 (앱 링크에서는 앱 주인 계정만)
- 코드는 대소문자·띄어쓰기를 가리지 않아요
- 코드는 js/catalog.js에 바꾼 값(해시)으로만 적혀 있어요. 코드를 바꾸려면 새 해시 값이 필요해요
- 앱 안에서 확인하는 잠금이라 코드를 아는 사람이 파일을 고치면 풀 수 있어요 (가벼운 잠금 용도)

## 공부 화면 (v9부터)
- [공부] 또는 [공부하기]를 누르면 컴활 1급 앱과 같은 공부 화면(문제풀기·벼락치기·오답노트·핵심요약·기록)이 전체 화면으로 열려요
- 모든 자격증이 같은 화면을 써요: 회차별 시험지, 랜덤 모의고사, 맞춤학습, 오늘의 문제, 플래시 카드, CBT 시험지, 학습 분석 등
- 공부 기록은 로그인한 계정에 저장돼요 (공부 화면 위 [← 패스메이트]로 돌아가기)

## 들어 있는 문제
- 컴활 1급 2,321문항 + 요약 (02_컴활1급-모의고사앱 2026-10-14_v5 데이터)
- 건축기사 3,900문항 + 요약 + 그림 (32_패스메이트 2026-10-14_v2 데이터)
- 한능검 심화 77회 기출 + 시대별 문항 256개 (15_한능검1급마스터 데이터)
- ADsP 예상문제 37개 + 과목별 요약 (자체 제작, 실제 기출 아님)
- 그 밖의 자격증은 [공부 → 내 문제]에서 붙여넣기로 추가하면 같은 공부 화면에서 풀 수 있어요

## 폴더 구조
```
index.html            패스메이트 (로그인·홈·공부·일정·오답·이력, 한 페이지)
css/style.css         패스메이트 디자인
css/engine.css        공부 화면 디자인 (컴활 1급 화면)
fonts/                Pretendard 글꼴 (SIL OFL 1.1)
js/catalog.js         자격증 정보 · 공식 시험 일정 · 난이도  ← 일정 고칠 때 여기
js/store.js           로그인 · 저장
js/firebase-config.js Firebase 연결값
js/app.js             패스메이트 화면과 기능
js/engine.js          공부 화면 (컴활 1급 화면·기능을 패스메이트에 넣은 것)
js/charts.js          차트 그림 (컴활)
data/c1 · ar · ad · kh  자격증별 exam.js(설정) questions.js summary.js(요약본) concept.js(개념학습) (+ c1/images.js, ar/fig/)
pdf/                  요약본 PDF (컴활 3개 · 건축기사 · ADsP · 한능검)
```

## 실행
- 내 컴퓨터: index.html 더블클릭
- GitHub Pages: 이 폴더 내용을 저장소에 그대로 올리고 Settings → Pages → Branch main / (root)

## GitHub에서 여러 기기 동기화 (Firebase)
1. Firebase 콘솔에서 프로젝트 만들기 → 웹 앱(</>) 등록 → firebaseConfig 값을 `js/firebase-config.js`에 붙여 넣기
2. Authentication → 로그인 방법 → 이메일/비밀번호 사용 설정
3. Firestore Database 만들기 (asia-northeast3 서울, 프로덕션 모드)
4. Firestore 규칙 탭에 아래 규칙을 붙여 넣고 게시
5. Authentication → 설정 → 승인된 도메인에 GitHub Pages 주소(예: luminahae.github.io) 추가

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    function isAdmin() {
      return signedIn() && request.auth.token.email == 'lumina.hae@gmail.com'
        && request.auth.token.email_verified == true;
    }
    // 내 공부 기록: 나만 읽고 쓰기
    match /users/{uid}/data/{doc} {
      allow read, write: if signedIn() && request.auth.uid == uid;
    }
    // 회원 명부: 본인이 적고, 관리자만 전체를 볼 수 있음
    match /members/{uid} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == uid);
      allow write: if signedIn() && request.auth.uid == uid;
      allow delete: if isAdmin() || (signedIn() && request.auth.uid == uid);
    }
    // 회원 권한(벼락치기 허용·차단, 이용 제한): 본인은 읽기만, 관리자만 바꿀 수 있음
    match /perms/{uid} {
      allow read: if isAdmin() || (signedIn() && request.auth.uid == uid);
      allow write: if isAdmin();
    }
  }
}
```

## 회원 관리 (관리자)
- 마이 페이지 → 코드 · 계정에서 관리자 코드를 넣으면 마이 페이지에 [회원 관리] 탭이 생겨요 (lumina.hae@gmail.com + 이메일 인증 완료 계정만)
- 회원마다 벼락치기 기본(코드 필요) / 허용(코드 없이) / 차단(코드를 넣어도 못 씀), 이용 제한(로그인해도 공부 화면·기록 사용 불가)
- 회원 명부는 각 회원이 로그인할 때 자동으로 생겨요. 이 버전 이전에 가입한 회원은 한 번 다시 로그인해야 목록에 보여요
- 위 규칙이 있어야 다른 사람이 권한을 바꾸거나 회원 목록을 볼 수 없어요
