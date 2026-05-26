# JLPT N3 회독

개인용 JLPT N3 회독 웹앱입니다.

현재 포함된 내용:

- 첫 화면 `언지 / 문법 / 독해 / 청해` 2x2 진입
- 유형별 `25개 누적 회독`
- 실데이터 기반 `N3` 카드 로드
- `문제 2` 오답 보기 생성
- `문제 4` 유의어 pair 간격 제어
- 로컬 진행 상태 저장
- PWA용 manifest / service worker / 아이콘

## 수정 흐름

이 프로젝트는 수정이 쉽게 `빌드 없는 정적 구조`로 유지합니다.

- UI 수정: `index.html`, `styles.css`, `app.js`
- 데이터 재생성: `scripts/build-n3-data.mjs`
- 수동 요미가나 보정: `data/furigana-overrides.json`
- 로컬 확인: `scripts/serve.mjs`

즉, 평소 수정할 때는 HTML/CSS/JS를 바로 고치고 바로 미리보기만 하면 됩니다.

## 로컬 확인

```bash
npm run dev
```

브라우저에서 [http://localhost:4173](http://localhost:4173) 으로 접속합니다.

이 방식은 `fetch("./data/n3.json")`가 정상 동작해서 파일 직접 열기보다 안정적입니다.

## 데이터 재생성

원본 파일:

- `_N3/1 일본어___해커스 N3.txt`

앱 데이터 재생성:

```bash
npm run build:data
```

생성 결과:

- `data/n3.json`

요미가나 수동 보정:

- `data/furigana-overrides.json`

## GitHub Pages 배포

이 저장소는 GitHub Actions 기반 GitHub Pages 배포를 사용합니다.

1. GitHub에 새 저장소를 만든다.
2. 이 폴더를 그 저장소에 push 한다.
3. GitHub 저장소의 `Settings > Pages`에서 `Build and deployment`가 `GitHub Actions`인지 확인한다.
4. `main` 브랜치에 push 하면 자동 배포된다..

## 체크

```bash
npm run check
```
