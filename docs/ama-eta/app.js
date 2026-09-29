'use strict';
const posts = [
{board:'자유게시판',title:'신입생인데 강의실까지 벽 타고 가도 되나요',body:'오늘 늦어서 벽으로 올라갔는데 안에 교수님이랑 눈 마주쳐서 그냥 내려왔어요.\n다시 계단으로 올라가니까 왜 내려갔냐고 하셨어요.',likes:12,comments:[['익명1','창문으로 들어오면 안 되긴 해요'],['익명2','그거 빗물통쪽에 잉크흘려서 몰래 들어가면 됨']]},
{board:'장터',title:'파블로 팝니다',body:'사진에 있는 거예요. 사용감 좀 있어요.\n\n좀 써봤는데 파블로 휴가 나을 거 같아서 급하게 바꾸느라 싸게 팝니다',likes:0,comments:[['익명1','쪽지확인부탁드립니다']]},
{board:'알바게시판',title:'평일 베어상회 나가는 사람들',body:'힘들지 않아??\n\n공부는 언제함??',likes:8,comments:[['익명1','난 주로 안하는거같아!!'],['익명2','걔들 연어말고 뵈는 거 없음']]},
{board:'자유게시판',title:'오늘 학식 카레 왜 초록색이냐',body:'이거 누구 잉크임 먹어도 됨??',likes:46,comments:[['익명1','맛있던데'],['익명2','아까 영양사 한분 리스폰되시더라']]},
{board:'비밀게시판',title:'심심한 문녀있어?',body:'쪽지해',likes:0,comments:[]},
{board:'자유게시판',title:'잉크 묻은 베스트 이거 맞냐',body:'중고로 샀는데 왜 빠니까 지워짐\n\n카탈로그 한정판이라서 비싸게 샀는데 ㅅㅂ',likes:72,comments:[['익명1','ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ'],['글쓴이','쳐웃지마라']]},
{board:'자유게시판',title:'과제 들고 가다가 모르는 분이 도와주심',body:'건물 앞에서 문을 못 열고 있었는데 열어주시고 몇 층 가냐고 물어보더라\n4층이라고 했더니 잠깐 고민하다 슈퍼점프로 날아감\n\n아니 상식적으로 그렇게 옮겨도 되는거였으면 나도 날아갔지\n\n가보니까 과제 박살나있고 걔는 튀었더라 이거 언제 새로 하냐',likes:31,comments:[]},
{board:'영역 배틀 게시판',title:'야 이 패션 테러리스트들아',body:'미대생이 옷 그따구로 입고 다니는 거 맞냐?\n\n아무리 기어파워가 안맞아도 정도가 있지 그럼 알바를 하던가',bold:true,likes:19,comments:[]},
{board:'자유게시판',title:'수업시간에 나이스 누르는 애들 뭐냐??',body:'교수님 뒤돌아볼때마다 조용히 나이스 치는 애들때문에 수업에 집중을 못하겠다\n\n원래 한명만 가끔 하던거같은데 점점 늘어나',likes:23,comments:[]}
];
const heart='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17S2 12 2 6.5C2 2 8 1 10 5c2-4 8-3 8 1.5C18 12 10 17 10 17Z"/></svg>';
const chat='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 3h14v11H9l-5 3v-3H3Z"/></svg>';
const avatar='<span class="avatar" aria-hidden="true"><svg viewBox="0 0 32 32"><circle cx="16" cy="11" r="6"/><path d="M4 30c0-16 24-16 24 0Z"/></svg></span>';
const esc=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const counts=p=>`<span class="counts"><span class="stat heart" aria-label="공감 ${p.likes}개">${heart}${p.likes}</span><span class="stat chat" aria-label="댓글 ${p.comments.length}개">${chat}${p.comments.length}</span></span>`;
const main=document.getElementById('main');
const times=['14:20','14:15','14:09','14:04','13:59','13:53','13:46','13:35','13:21'];
let listScroll=0;
function render(){
 const match=location.hash.match(/^#post-(\d+)$/);const index=match?Number(match[1])-1:-1;const post=posts[index];
 if(!post){
 document.title='해녀 미술 대학 · 에타';
 main.innerHTML='<h1 class="list-heading">전체 글</h1>'+posts.map((p,i)=>`<a class="post-link" href="#post-${i+1}"><div class="board">${esc(p.board)}</div><h2>${esc(p.title)}</h2><p class="preview">${esc(p.body.replace(/\n+/g,' '))}</p><div class="meta"><span>09/29 ${times[i]}</span><span>· 익명</span>${counts(p)}</div></a>`).join('');
 requestAnimationFrame(()=>window.scrollTo(0,listScroll));
 }else{
 document.title=post.title+' · 해녀 미술 대학';
 main.innerHTML=`<div class="detail-nav"><button class="back" aria-label="글 목록으로 돌아가기"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 4-8 8 8 8"/></svg></button><h1>${esc(post.board)}</h1></div><article class="post"><div class="author">${avatar}<div><div class="author-name">익명</div><div class="date">09/29 ${times[index]}</div></div></div><h2>${esc(post.title)}</h2><p class="body${post.bold?' emphasis':''}">${esc(post.body)}</p><div class="meta">${counts(post)}</div></article><section class="comments" aria-label="댓글">${post.comments.map(([name,text])=>`<div class="comment${name==='글쓴이'?' reply':''}"><div class="comment-author${name==='글쓴이'?' writer':''}">${avatar}${esc(name)}</div><p>${esc(text)}</p><div class="date">09/29</div></div>`).join('')}</section><div class="detail-bottom"><a class="return-link" href="#">목록으로</a></div>`;
 main.querySelector('.back').addEventListener('click',()=>{location.hash='';});window.scrollTo(0,0);
 }
}
main.addEventListener('click',e=>{if(e.target.closest('.post-link'))listScroll=window.scrollY;});
window.addEventListener('hashchange',()=>{render();main.tabIndex=-1;main.focus({preventScroll:true});});
render();
