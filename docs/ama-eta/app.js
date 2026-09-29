'use strict';
const posts = [
{board:'자유게시판',title:'신입생인데 강의실까지 벽 타고 가도 되나요',body:'오늘 늦어서 벽으로 올라갔는데 안에 교수님이랑 눈 마주쳐서 그냥 내려왔어요.\n다시 계단으로 올라가니까 왜 내려갔냐고 하셨어요.',likes:12,comments:[['익명1','창문으로 들어오면 안 되긴 해요'],['익명2','그거 빗물통쪽에 잉크흘려서 몰래 들어가면 됨']]},
{board:'장터',title:'파블로 팝니다',body:'사진에 있는 거예요. 사용감 좀 있어요.\n\n좀 써봤는데 파블로 휴가 나을 거 같아서 급하게 바꾸느라 싸게 팝니다',likes:0,comments:[['익명1','쪽지확인부탁드립니다']]},
{board:'알바게시판',title:'평일 베어상회 나가는 사람들',body:'힘들지 않아??\n\n공부는 언제함??',likes:8,comments:[['익명1','난 주로 안하는거같아!!'],['익명2','걔들 연어말고 뵈는 거 없음']]},
{board:'자유게시판',title:'오늘 학식 카레 왜 초록색이냐',body:'이거 누구 잉크임 먹어도 됨??',likes:46,comments:[['익명1','맛있던데'],['익명2','아까 영양사 한분 리스폰되시더라']]},
{board:'비밀게시판',title:'심심한 문녀있어?',body:'쪽지해',likes:0,comments:[]},
{board:'자유게시판',title:'잉크 묻은 베스트 이거 맞냐',body:'중고로 샀는데 왜 빠니까 지워짐\n\n카탈로그 한정판이라서 비싸게 샀는데 ㅅㅂ',likes:72,comments:[['익명1','ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ'],['글쓴이','쳐웃지마라']]},
{board:'자유게시판',title:'과제 들고 가다가 모르는 분이 도와주심',body:'건물 앞에서 문을 못 열고 있었는데 열어주시고 몇 층 가냐고 물어보더라\n4층이라고 했더니 잠깐 고민하다 슈퍼점프로 날아감\n\n아니 상식적으로 그렇게 옮겨도 되는거였으면 나도 날아갔지\n\n가보니까 과제 박살나있고 걔는 튀었더라 이거 언제 새로 하냐',likes:31,comments:[]},
{board:'영역 배틀 게시판',title:'야 이 패션 테러리스트들아',body:'미대생이 옷 그따구로 입고 다니는 거 맞냐?\n\n아무리 기어파워가 안맞아도 정도가 있지 그럼 알바를 하던가',likes:19,comments:[]},
{board:'자유게시판',title:'수업시간에 나이스 누르는 애들 뭐냐??',body:'교수님 뒤돌아볼때마다 조용히 나이스 치는 애들때문에 수업에 집중을 못하겠다\n\n원래 한명만 가끔 하던거같은데 점점 늘어나',likes:23,comments:[]},
{"board": "자유게시판", "title": "카오폴리스관 엘베 점검 중인 거 진짜냐", "body": "4층까지 과제 합판 들고 걸어 올라가라는 거임 지금?\n계단 폭 넓어서 벽 타고 올라가지도 못하는데 미쳤나 진짜", "likes": 0, "comments": [["익명1", "계단 구석에 잉크 살짝 칠해진 곳 있음 거기 타고 올라가셈"], ["익명2", "저거 어제부터 점검 중이었는데 아직도 안 고침?"], ["익명3", "나 아까 타고 왔는데 점검 아닌듯?"]]},
{"board": "장터", "title": "스퀵 클린 깨끗한 거 팝니다", "body": "이번 학기 교양 때 쓸라고 샀는데 저랑 진짜 안 맞아서 판매해요\n거리 조절 안 돼서 두세 번 쓰고 모셔뒀어요\n직거래 미대 조형관 앞 가능", "likes": 0, "comments": [["익명1", "ㅇㅁ"]]},
{"board": "자유게시판", "title": "복도에 구멍 뚫어논거 누구냐??", "body": "징어폼으로 이동하다가 바닥 뚫린 줄 모르고 그대로 떨어져서 리스폰됨\n과제 박스 물에 다 젖어서 다시 뽑아야 함\n아 씨발 진짜 존나 화난다 왜 복도에 구멍을 뚫어놓는 건데", "likes": 0, "comments": [["익명1", "ㅋㅋㅋㅋㅋ 거기 조형관 2층 구석이지?"], ["익명2", "아 거기 지난주에도 누구 떨어지던데 아직도 안 막았냐"], ["익명3", "그거 철망으로 막아놔서 징어폼으론 뚫림 ㅋㅋㅋ"]]},
{"board": "자유게시판", "title": "학식당에 모자 두고 가신 분", "body": "2층 학식당 창가 자리 테이블 밑에 켄사키 비니 두고가신분\n분실물 센터에 맡겨둘 테니까 찾아가세요", "likes": 0, "comments": []},
{"board": "자유게시판", "title": "히두라 쓰는 사람?", "body": "진짜 궁금해서 그러는데 그거 무거워서 어케씀??\n내 친구가 맨날 쓰길래 나도 빌려써봤는데\n잘도 어깨 안 빠지나 싶음", "likes": 0, "comments": [["익명1", "걍 참고 쓰셈"]]},
{"board": "장터", "title": "오닌 재킷 팝니다", "body": "상의 재킷이고 저번에 대충 사서 쓰다 팝니다\n오닌에 오속 오속 잉저 붙어있어요\n이제 카본 안쓸거같아서 팝니다", "likes": 0, "comments": [["익명1", "문닌이라고 해라"]]},
{"board": "자유게시판", "title": "오늘 야작하는 사람 더 있음?", "body": "나 혼자 카오폴리스관에 있는 것 같은데 무섭다\n아무 없는데 자꾸 구석에서 이상한 소리 들림", "likes": 0, "comments": [["익명1", "거기 환풍구에서 가끔 연어 나옴 확인해보셈"]]},
{"board": "알바게시판", "title": "베어상회 대타 구해요", "body": "오늘 저녁 8시 타임 대타 구합니다\n급한 사정 생겨서 못 가게 되었어요\n시간당 2000게소씩 더 쳐드릴게요\n전설 80 이상만 쪽지 주세요", "likes": 0, "comments": []},
{"board": "자유게시판", "title": "누가 분수대에 비콘 깔아뒀냐", "body": "누가 방금 분수대에 슈점뛴거같은데\n날아오자마자 바로 녹아죽네", "likes": 0, "comments": [["익명1", "ㅋㅋㅋㅋㅋㅋㅋㅋ"], ["익명2", "그걸 안보고 뛰는 사람이 있네"], ["글쓴이", "잠시만 교수님인거같은데??"]]},
{"board": "비밀게시판", "title": "통통한 문녀 있음?", "body": "쪽지 ㄱ", "likes": 0, "comments": []},
{"board": "비밀게시판", "title": "여장 좋아하는 잉남 ㅇㄸ", "body": "ㅇㅇ", "likes": 0, "comments": []},
{"board": "자유게시판", "title": "같이 알바하는 애 좋아하는데", "body": "좋아한다고 티를 어떻게 내야 할지 모르겠음\n진짜 얘때문에 맨날 시간맞춰서 베어상회 가는데\n다음 바이콘 같이 가자고 해볼까??", "likes": 0, "comments": [["익명1", "ㄱㄱ"], ["익명2", "문어임?"]]},
{"board": "자유게시판", "title": "버스에선 잉크통 앞으로 차면 안 되나요", "body": "진짜 좀 최소한의 배려라는 게 있는데\n적어도 사람 몰리는 시간에는 좀 앞으로 차면 좋겠습니다\n하…", "likes": 0, "comments": []}
];
const thumb='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 9l3-6c1-2 3-1 2 2l-1 3h5c1 0 2 1 1.5 2L16 16H7ZM3 9h3v8H3Z"/></svg>';
const chat='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M17 8.5c0 3-3 5.5-7 5.5H8l-4 3 1-5C1 9 3 3 10 3c4 0 7 2.5 7 5.5Z"/></svg>';
const avatar='<span class="avatar" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="13" r="7"/><path d="M5 32c0-17 22-17 22 0Z"/></svg></span>';
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const counts=p=>`<span class="counts"><span class="stat like" aria-label="공감 ${p.likes}개">${thumb}${p.likes}</span><span class="stat chat" aria-label="댓글 ${p.comments.length}개">${chat}${p.comments.length}</span></span>`;
const main=document.getElementById('main');
const menu=document.getElementById('board-menu');
const title=document.getElementById('page-title');
const boards=['전체 글','자유게시판','비밀게시판','장터','알바게시판','영역 배틀 게시판'];
const times=['14:20','14:15','14:09','14:04','13:59','13:53','13:46','13:35','13:21','13:15','13:10','13:04','12:58','12:51','12:46','12:39','12:31','12:25','12:19','12:13','12:06','11:58'];
let listScroll=0;
let listHash='#';
function render(){
  const match=location.hash.match(/^#post-(\d+)$/);
  const index=match?Number(match[1])-1:-1;
  const post=posts[index];
  const boardMatch=location.hash.match(/^#board-([1-5])$/);
  const board=boardMatch?boards[Number(boardMatch[1])]:null;
  const selected=post?post.board:board;
  document.body.classList.toggle('detail-view',Boolean(post));
  title.textContent=selected||'';
  menu.innerHTML=boards.map((b,i)=>`<a href="${i?'#board-'+i:'#'}"${(selected===b||(!selected&&i===0))?' aria-current="page"':''}>${esc(b)}<i aria-hidden="true"></i></a>`).join('');
  if(!post){
    document.title=(board||'해녀 미술 대학')+' · 에타';
    main.innerHTML=`<h2 class="list-heading">${esc(board||'전체 글')}</h2>`+posts.map((p,i)=>!board||p.board===board?`<a class="post-link" href="#post-${i+1}"><h2>${esc(p.title)}</h2><p class="preview">${esc(p.body.split('\n')[0])}</p><div class="meta">${counts(p)}<span class="time">09/29 ${times[i]}</span><span class="anonymous">익명</span>${!board?'<span class="board">'+esc(p.board)+'</span>':''}</div></a>`:'').join('');
    requestAnimationFrame(()=>window.scrollTo(0,listScroll));
  }else{
    document.title=post.title+' · 해녀 미술 대학';
    main.innerHTML=`<article class="post"><div class="author">${avatar}<div><div class="author-name">익명</div><div class="date">09/29 ${times[index]}</div></div></div><h2>${esc(post.title)}</h2><p class="body">${esc(post.body)}</p><div class="meta">${counts(post)}</div></article><section class="comments" aria-label="댓글">${post.comments.map(([name,text])=>`<div class="comment${name==='글쓴이'?' reply':''}"><div class="comment-author${name==='글쓴이'?' writer':''}">${avatar}${esc(name)}</div><p>${esc(text)}</p><div class="date">09/29</div></div>`).join('')}</section><div class="detail-bottom"><a class="return-link" href="${listHash}" aria-label="글 목록으로 돌아가기"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/></svg>글 목록</a></div>`;
    window.scrollTo(0,0);
  }
}
main.addEventListener('click',e=>{
  if(e.target.closest('.post-link')){listScroll=window.scrollY;listHash=location.hash||'#';}
});
menu.addEventListener('click',e=>{if(e.target.closest('a'))listScroll=0;});
document.getElementById('menu-toggle').addEventListener('click',e=>{
  menu.hidden=!menu.hidden;
  e.currentTarget.setAttribute('aria-expanded',String(!menu.hidden));
});
window.addEventListener('hashchange',()=>{render();main.tabIndex=-1;main.focus({preventScroll:true});});
render();
