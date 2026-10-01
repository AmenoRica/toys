# toys

브라우저에서 가지고 노는 작은 장난감 모음.

- 사이트: https://amenorica.github.io/toys/
- 그림판: https://amenorica.github.io/toys/sketch/
- 잉크: https://amenorica.github.io/toys/ink/
- 화음 연습실: https://amenorica.github.io/toys/chord/

## 구조

```text
docs/
  index.html          목록 페이지
  home.css
  shared/base.css     모든 toy의 공통 디자인
  sketch/             첫 번째 toy: 그림판
  ink/                잉크와 이미지 클리핑
  chord/              피아노 롤 화음 연습
tests/sketch/         그림판 브라우저 회귀 검사
tests/ink/            잉크와 이미지 클리핑 검사
tests/chord/          화음 채점·표기·연습 상태 검사
DESIGN.md             공통 디자인 기준
AGENTS.md             앞으로의 작업 지침
```

## 로컬 실행

이 폴더에서 `python3 -m http.server 8767 --bind 127.0.0.1`을 실행하고 `http://127.0.0.1:8767/docs/`를 연다. 앱은 외부 API나 라이브러리를 사용하지 않는다. 그림은 서버로 전송되지 않는다.

그림판 검사는 `http://127.0.0.1:8767/tests/sketch/tests.html`에서 실행한다. 필압 검사는 합성 PointerEvent를 사용하며 실제 펜 장치 검증을 대신하지 않는다.

## 새 toy 추가

1. `DESIGN.md`를 읽고 `docs/<slug>/`에 정적 HTML/CSS/JS를 만든다.
2. `../shared/base.css`를 연결하고 `../`로 돌아가는 목록 링크를 둔다.
3. `docs/index.html`의 목록에 제목·짧은 설명·상대 경로 링크를 추가한다.
4. 데스크톱/좁은 화면과 직접 하위 경로 접근을 검증한다.
5. `main`에 push하면 GitHub Pages가 `docs/`를 자동 게시한다.

ZIP이나 별도 빌드 도구가 필요하지 않다. 공통 디자인은 이 저장소의 모든 toy에 적용한다.

## 그림판

800×600 흰 캔버스, AA 없는 브러시/지우개, 26색, 좌·우클릭 색 선택과 그리기, 채우기, 최근 30개 작업 undo/redo, 필압, 사용자 지정 단축키, PNG 저장을 제공한다. 이미지 불러오기에서 미리보기를 드래그하거나 확대·축소해 800×600에 원하는 부분을 맞출 수 있다. 적용하면 기존 그림을 교체하고 여백·투명 영역은 흰색으로 처리하며, 취소와 undo/redo를 지원한다. 파일은 브라우저 안에서만 읽고 서버에 전송하지 않는다. 브러시 크기는 1~64px이고 4/12/24/40px 프리셋은 캔버스 아래에 있다. 그림은 자동 저장되지 않으므로 창을 닫기 전에 PNG로 저장한다.

기본 단축키: B 브러시, E 지우개, F 채우기, U undo, R redo, C 비우기, S 색 교환, [/] 크기 조절. Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl+Y, Ctrl/⌘+S도 지원한다.

[skribbl.io](https://skribbl.io/)의 공개 안내와 설정 화면에서 조작을 참고했으며 원본 코드·이미지·로고를 복사하지 않았다. 원본 게임의 멀티플레이/채팅 기능은 포함하지 않는다.

## 잉크

클릭·터치로 회색 잉크를 쏘고 무작위 굵기의 방울을 흘립니다. 배경 이미지와 잉크 이미지를 각각 선택하면 잉크 자국과 줄기 안에서만 두 번째 이미지가 드러납니다. 이미지는 작업 영역에 중앙 정렬로 꽉 차며, 비우기는 이미지를 유지합니다. 이미지는 외부로 전송하거나 저장하지 않습니다.

Google의 스플래툰 이스터에그를 시각 참고했으며 코드·이미지·음원은 재사용하지 않고 곡선과 Canvas로 직접 구현했습니다. `tests/ink/tests.html`에서 터치 포인터, 흐름, 초기화, 로컬 이미지 선택과 클리핑을 검사합니다. 합성 터치 검사는 실제 모바일 기기 검사를 대신하지 않습니다.

## 화음 연습실

주어진 근음과 화음 종류를 보고 피아노 롤에서 나머지 구성음을 선택합니다. 3화음 6종과 7화음 5종, 무작위 또는 고정 근음, 음 선택·삭제, 근음/선택한 화음 듣기, 볼륨·정지, 채점·정답 보기·다음 문제·음 지우기를 제공합니다. Space로 듣기, Enter로 확인, N으로 다음 문제를 시작할 수 있습니다.

근음 위 한 옥타브 안의 기본자리만 채점하며 이명동음은 같은 음으로 처리합니다. 근음은 고정이고 옥타브 근음 추가는 오답입니다. 첫 채점만 점수와 연속 정답에 반영하며 정답 보기는 오답 처리합니다. 기록은 현재 페이지 세션에만 남고 새로고침하면 초기화됩니다. 소리는 클릭 이후 Web Audio로 생성하며 외부 음원이나 서버를 사용하지 않습니다. 정답 확인과 정답 보기에는 코드의 구성 원리와 근음 기준 반음 간격을 함께 표시합니다.

Node.js 20 이상에서 의존성 설치 없이 검사합니다. 정적 파일이 정본이므로 별도 lint/typecheck/build 명령은 없습니다.

```sh
node --check docs/chord/app.js
node --check docs/chord/music.js
node --test tests/chord/*.test.mjs
```

[원본 CHORD / LAB](https://chord-lab-practice.suyasuyazzang.chatgpt.site/)의 commit `4ea50c2ecd694908181cc2a9d4eda55b98366514`에서 가져와 toys의 공통 디자인에 맞췄습니다. 원본 Sites 배포 설정은 가져오지 않았습니다. Node 검사는 실제 브라우저 렌더링이나 소리를 대신하지 않습니다.
