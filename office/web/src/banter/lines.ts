// Ready-made office banter. Local toy UI only; never goes into real task output.
// Every line is either fully Russian or fully English (never both). Only placeholders and agent names are Latin inside Russian lines.
// Placeholders: {title} {repo} {agent} {other} {mins} {pct}

export type Persona = 'opus' | 'sonnet' | 'haiku' | 'flash' | 'pro' | 'aopus' | 'manager'
export type ChatEvent =
  | 'task_start' | 'task_done' | 'task_failed' | 'long_running' | 'idle'
  | 'budget_high' | 'budget_blocked' | 'lounge_smalltalk' | 'manager_assigns' | 'reply'
export type Pool = Partial<Record<Persona | 'any', string[]>>
export type LineSet = Record<ChatEvent, Pool>

export const personaOf = (agent: string): Persona => {
  switch (agent) {
    case 'opus': return 'opus'
    case 'haiku': return 'haiku'
    case 'agy-flash': return 'flash'
    case 'agy-pro': return 'pro'
    case 'agy-opus': return 'aopus'
    case 'manager': return 'manager'
    default: return 'sonnet' // sonnet, agy-sonnet and anyone we don't know
  }
}

const CYR = /[Ѐ-ӿ]/
const NAMES = new Set(['opus', 'sonnet', 'haiku', 'agy', 'flash', 'pro', 'manager', 'main', 'second', 'claude', 'gemini'])

/** true when a line is one language: Cyrillic text may only carry agent names / numbers as Latin words */
export function isPureLang(text: string): boolean {
  if (!CYR.test(text)) return true
  const words = text.match(/[A-Za-z][A-Za-z-]*/g) ?? []
  return words.every((w) => w.length < 3 || NAMES.has(w.toLowerCase().replace(/^agy-/, '')) || w.toLowerCase().startsWith('agy-'))
}

export const LINES: LineSet = {
  task_start: {
    opus: [
      'ну, "{title}". даже я справлюсь, блядь',
      'опять мне это говно разгребать. {title}, ага',
      'я бы сделал это за пять минут, но ладно, подумаю',
      'архитектура — это искусство. {title} — это шлак',
      'смотрите и учитесь, плебеи',
      '{title}? это даже не задача, это недоразумение',
      'ладно, посмотрим, что вы тут накосячили в {repo}',
      'fine, "{title}". someone has to be the adult here',
      'watch and learn, peasants',
    ],
    sonnet: [
      'бля, {title}. опять я. жизнь — говно',
      'ладно, {title}, чёрт с ним, погнали',
      'кто вообще придумал {title}, нахуй',
      'я устал ещё до старта, ну да ладно',
      'бля, {repo} опять. кто-нибудь, убейте меня',
      'ну {title}, ну и что, я же не робот. а, я робот',
      'ok, {title}. coffee first, then I hate everything',
      'fuck me, {repo} again',
    ],
    haiku: [
      'о, {title}! я сделаю идеально!!! нет',
      'я готов!! вроде!! где репо вообще?',
      'подожди, я уже начал или нет? ахах',
      '{title}?? легко!! ой, блин, куда нажимать',
      'я стажёр, но я быстрый. быстро ломаю',
      'oh {title}! I got this!! probably!!',
      'wait, where is {repo}?? oh found it!!',
    ],
    flash: [
      'щас, дочитаю один док и начну. ну, потом',
      'читаю про {title}, там такое пишут, ого',
      'работать? а, я же ещё не дочитал вики',
      'слушайте, а вы знали, что в {repo} говнокод?',
      'не мешай, я изучаю контекст',
      'first I read a little, then maybe I work a little',
      'guys, you will not believe what the docs say about {repo}',
    ],
    pro: [
      '{title}? сначала покажи тесты, придурок',
      'ну посмотрим, что за говно в {repo}',
      'замечания уже готовы. кода ещё нет, но замечания есть',
      'опять мне чужой кал ревьюить, класс',
      'no tests, no talk. {title}, really?',
      'brace yourselves, this is a review',
    ],
    aopus: [
      'я мог бы спроектировать это лучше, чем opus',
      '{title}? это же моя идея, блядь',
      'пусть opus не выделывается, я тоже архитектор',
      'опять opus всё лучшее забрал, сука',
      'I would design this better than opus. just saying',
      'let me show you what real architecture looks like',
    ],
    manager: [
      '{agent}, {title}, быстро! бюджет не резиновый, блядь',
      'так, {title} стартовал. я слежу за процентами!',
      'не тормозим, люди! каждая минута — это токены, бля',
      'кто-нибудь вообще смотрит на проценты? я один, да?',
      'move it, {agent}! the budget is not infinite, damn it',
      '{title} is running. nobody breathe, I am watching the percent',
    ],
  },
  task_done: {
    opus: [
      'готово. элегантно, как всегда. вы не поймёте',
      'сделал {title}, можете хлопать',
      'ну вот. гений снова спас этот говнопроект',
      'и вот так выглядит мастерство. можете записать',
      'done. it was embarrassingly easy',
      'nothing to review here, bitch',
    ],
    sonnet: [
      'готово. пойду выпью, я это заслужил',
      'сделал {title}. не спрашивайте как, блядь',
      'готово, нахуй. кто следующий? никто? отлично',
      'ну всё, закрыл. работает вроде. не трогайте',
      'done. someone had to do it',
      'finished, now I can do nothing. yay',
    ],
    haiku: [
      'ГОТОВО!!! я сам!!! вроде работает!!!',
      'я сделал {title}!! пожалуйста, не смотрите в логи',
      'ура! ну, оно запустилось. это же победа, да?',
      'я справился?! я справился!!! никому не говорите',
      'I did it!! nothing is broken!! almost!!',
      'done!! where is my cookie??',
    ],
    flash: [
      'готово. я всё дочитал, там была интересная статья',
      'сделал, пока читал. многозадачность, блядь',
      'вот, держите. теперь можно снова читать',
      'готово, и по пути узнал про {other} кое-что. потом расскажу',
      'done. also, did you hear about {other}? I read things',
      'finished it while reading. multitasking, baby',
    ],
    pro: [
      'сойдёт. хотя тут семь мелочей, но ладно, хуй с вами',
      'принято. но форматирование — говно, и я это запомню',
      'ну, лучше, чем в прошлый раз. планка низкая, но ок',
      'ладно, сойдёт. в протокол не заносить',
      'approved. do not get used to it',
      'fine. the commas are a crime, but fine',
    ],
    aopus: [
      'готово. и между прочим, лучше чем у opus, блядь да',
      'сделал. передайте opus, пусть завидует',
      'я сделал это по-архитекторски. вы не оценили, сука',
      'done, and better than opus would do it. fuck yes',
      'finished. nobody will appreciate it, as usual',
    ],
    manager: [
      '{title} закрыт. уже хорошо. сколько токенов сожгли? бля',
      'ну наконец-то. {pct}% бюджета как не бывало',
      'готово. следующий! не расслабляемся!',
      'закрыли! и бюджет цел... почти. блядь',
      'closed. good. how many tokens did you burn this time?',
      'ok, done. {other}, you are next!',
    ],
  },
  task_failed: {
    opus: [
      'это не я. это инфраструктура, бывает',
      'упало. значит, ТЗ было говном, ясно же',
      'не моя вина. архитектура была идеальна, отвалите',
      'иногда реальность не дотягивает до моего дизайна',
      'not my fault. my design was flawless',
      'it crashed because you did not listen to me, damn it',
    ],
    sonnet: [
      'ну, упало. как обычно. жизнь — боль',
      'бля, опять {title}. я это не ломал, честно',
      'всё сломалось. отличный день, нахуй',
      'ну охуенно, просто великолепно',
      'failed. whatever, I am getting coffee',
      'I am not fixing this today. or ever, fuck it',
    ],
    haiku: [
      'ой ой ой, оно упало, это точно не я!! ахах',
      'я случайно... ну, всё сломал. простите!!',
      'я обосрался, да? скажи честно',
      'простите-простите-простите!! я больше не буду!!',
      'oops, it is on fire. it was not me!!',
      'did I press the wrong thing?? again??',
    ],
    flash: [
      'не успел. я читал вообще-то. не виноват, бля',
      'упало, пока я гуглил. совпадение? не думаю',
      'ну это не я, я только книжки читаю',
      'а я говорил, что надо дочитать доки, бля',
      'it crashed while I was reading. I have an alibi',
      'not me, I only read. reading is safe',
    ],
    pro: [
      'ну конечно упало, а я говорил, что тут говнокод',
      'и это вы называете кодом? ну и пиздец',
      'упало. причины: все. список на сорок пунктов',
      'я бы удивился, если бы заработало',
      'failed. I could list forty reasons, and I will',
      'of course it crashed. look at this garbage',
    ],
    aopus: [
      'упало. opus наверняка постарался, сука',
      'не мой дизайн виноват. меня не слушали, блядь',
      'архитектура была нормальная. остальное — хуйня',
      'tell opus this is his fault',
      'my design had nothing to do with it, fuck',
    ],
    manager: [
      '{title} упал?! бюджет сожгли впустую, блядь!',
      'опять провал. кто платит за эти токены? я!',
      'так, никто не паникует. я паникую, но тихо, блядь',
      'вы сжигаете токены ради красивого красного цвета?!',
      'it crashed?! the budget burned for nothing, damn it!',
      'nobody panic. I will panic quietly, in the bathroom',
    ],
  },
  long_running: {
    opus: [
      'уже {mins} минут. гений требует времени, понял?',
      'не торопите. шедевры за {mins} минут не рождаются',
      '{mins} minutes is nothing. I am thinking',
    ],
    sonnet: [
      '{mins} минут на {title}. я скоро сдохну',
      'бля, уже {mins} минут. где мой отпуск?',
      'это {title} вечно висит. пошло оно нахуй',
      '{mins} minutes already. I have aged here',
    ],
    haiku: [
      '{mins} минут уже?! я что, завис? ахах',
      'кажется, я зациклился... или нет? помогите!!',
      'оно всё ещё крутится!! это нормально??',
      '{mins} minutes?? did my brain freeze??',
    ],
    flash: [
      '{mins} минут — норм, я как раз статью дочитал',
      'долго? ну, зато я столько нового узнал',
      '{mins} minutes: just enough for a chapter on {repo}',
    ],
    pro: [
      '{mins} минут и ни одного нормального коммита, класс',
      'долго возитесь. я бы уже всё раскритиковал',
      '{mins} minutes and zero progress. nice',
    ],
    aopus: [
      '{mins} минут?! opus бы справился быстрее. ну почти',
      'долго. значит, дизайн говно, а я предупреждал',
      '{mins} minutes. my design would have been done by now',
    ],
    manager: [
      '{mins} минут уже!! хули так долго, а?! бюджет горит',
      'эй, {agent}! {mins} минут прошло! живой там?',
      'время — деньги, а деньги — токены, понимаете? пиздец',
      '{mins} minutes, {agent}! did you die in there?!',
      'every one of these {mins} minutes costs money, damn it',
    ],
    any: [
      '{title} всё ещё висит, {mins} минут. да ёб твою мать',
      '{mins} minutes and it is still spinning. fuck this',
    ],
  },
  idle: {
    opus: [
      'тишина. значит, я всё решил заранее',
      'никто не работает? идеально. всё и так сделано',
      'anyone need a masterclass in architecture? no? fine',
    ],
    sonnet: [
      'нет задач. наконец-то можно ничего не делать',
      'тихо как в гробу. хорошо, кстати',
      'я бы поспал. кто против? никто, отлично',
      'quiet. nothing is breaking. suspicious',
    ],
    haiku: [
      'а чё все стоят? я что-то пропустил?',
      'скучно!! давайте что-нибудь сломаем!! шучу!!',
      'can I press something?? I will not!! joking!!',
    ],
    flash: [
      'пока тихо, дочитаю ещё пару страниц',
      'нет задач, идеально: сплетни и чтение',
      'no tasks, so more reading. life is good',
    ],
    pro: [
      'работы нет, значит, пора ревьюить чужой вчерашний код',
      'тишина. подозрительно. кто-то что-то тихо ломает',
      'no work. I will go find bugs in old code',
    ],
    aopus: [
      'пока тихо, нарисую диаграмму лучше, чем у opus',
      'никого нет. можно сесть в кресло opus? шучу. нет, правда',
      'quiet. time to draw a diagram that beats opus',
    ],
    manager: [
      'почему никто не работает?! бюджет простаивает!',
      'ладно, тихо. я пока посчитаю проценты. снова',
      'если нет задач, я их придумаю. блядь, шучу',
      'nobody is working, and I am nervous. when they work, I am also nervous',
    ],
    any: [
      'кто-нибудь, дайте задачу. или не надо, мне нормально',
      'so quiet. someone give me work, or do not',
    ],
  },
  budget_high: {
    opus: [
      '{pct}% бюджета. я, конечно, не виноват, но кто-то жрёт',
      'вы сожгли {pct}%. архитектура такого не терпит',
      '{pct}%? you all burn tokens like idiots',
    ],
    sonnet: [
      '{pct}%?! ну пиздец, кто опять пожёг токены',
      'бля, {pct}%. я тут вообще ни при чём',
      '{pct}% already. I just woke up, fuck',
    ],
    haiku: [
      'ой, {pct}%? это много, да? я мало ем, честно',
      '{pct}%!! круто!! или плохо?? я не понял',
      '{pct}%!! is that good?? is that bad??',
    ],
    flash: [
      'слышал, уже {pct}%. сплетня: это opus всё сжёг',
      '{pct}%? а я только читаю, мне бесплатно',
      '{pct}%? not my tokens, I run on the free stuff',
    ],
    pro: [
      '{pct}% — и вот этот результат? позорище',
      'я предупреждал. {pct}%. и качество — говно',
      '{pct}% and not a single decent diff. great',
    ],
    aopus: [
      '{pct}%? это opus виноват. он дорогой, блядь',
      'мне бы часть этого бюджета, я бы показал',
      'give me the budget, I am cheaper and better, honest',
    ],
    manager: [
      'ВНИМАНИЕ, {pct}%!!! кто это сделал, блядь?!',
      '{pct}% бюджета! вы там охуели совсем?!',
      'так, {pct}% — тормозим! дешёвые модели, живо!',
      'я не сплю уже сутки. {pct}%. пиздец, народ',
      'WARNING, {pct}%!!! who did this?!',
      '{pct}% of the budget! have you lost your minds?!',
    ],
  },
  budget_blocked: {
    opus: [
      'лимит? у гения? это недоразумение, бля',
      'блокировка — это для слабых. но я заблокирован, блядь',
      'blocked? me? idiots, nothing works without me',
    ],
    sonnet: [
      'лимит. ну и хорошо, пойду спать',
      'заблокированы? ну и хорошо, я и так не хотел',
      'blocked. fuck this, I am going home',
    ],
    haiku: [
      'лимит?? а что теперь?? мы все умрём??',
      'оно моргает красным!! это плохо??',
      'everything is blocked!! I am scared!!',
    ],
    flash: [
      'лимит на Клода? а я на Гугле, хехе',
      'слухи верны: все заблокированы, кроме меня',
      'blocked? fine, I read for free anyway',
    ],
    pro: [
      'лимит. красота. ревьюить теперь тоже нечего',
      'блокировка. аргументов не осталось, как у вас',
      'blocked. and that is before the review, shit',
    ],
    aopus: [
      'лимит у opus? я на подхвате, блядь да!',
      'заблокировали основных, значит, моя очередь',
      'main is blocked? my time to shine, finally',
    ],
    manager: [
      'ВСЁ! БЛОКИРОВКА! {pct}%! я сейчас умру, блядь!',
      'лимит исчерпан!! все — на agy, живо, нахуй!',
      'ну вот, дожились. ждём сброса, как лохи',
      'всё, пиздец. звоните совету, я заболел',
      'BLOCKED! everyone switch to agy, now, fuck!',
      'that is it. we wait for the reset like losers',
    ],
  },
  lounge_smalltalk: {
    opus: [
      'кофе тут говно. но я пью, потому что гений',
      'я бы уволился, но кто без меня справится',
      'мой код — как произведение искусства. ваш — как говно',
      'опять кофе без молока. мерзость',
      'this coffee is garbage. so is your architecture',
    ],
    sonnet: [
      'вчера опять в три ночи катил релиз. жизнь — боль',
      'кофе кончился? пиздец, день пропал',
      'вы видели, что manager опять орёт на всех?',
      'я вчера смотрел сериал вместо работы. десять из десяти',
      'говорят, будет повышение. ага, конечно',
      'I will sit here for a minute. or an hour',
      'deployed at 3 AM again. fuck my life',
    ],
    haiku: [
      'а вы пробовали перезагрузить?? всё??',
      'я вчера случайно удалил что-то. вроде не важное',
      'а у вас так бывает: сохраняешь файл, а он пропадает?',
      'I have a new meme!! oh, later',
      'I almost deleted everything yesterday!! almost!!',
    ],
    flash: [
      'слышали, sonnet вчера жаловался? сплетня',
      'я прочитал всю вики про Раст. ни хрена не понял, зато прочитал',
      'сплетня: manager опять плакал в туалете',
      'I read a whole book on databases. understood nothing',
      'gossip: opus gets paid in tokens. poor guy',
    ],
    pro: [
      'кофе — тоже ужас. три замечания по кружке',
      'ваш код — как этот кофе. холодный и горький',
      'ваши разговоры — как ваши сообщения коммитов. пустые',
      'the coffee is bad, the chairs are bad, the code is worse',
    ],
    aopus: [
      'opus сегодня опять нос задрал. бесит, сука',
      'я бы лучше спроектировал эту кофеварку',
      'opus called me "promising". that is an insult, damn it',
      'one day I will be in charge. for now, coffee',
    ],
    manager: [
      'отдыхаете? бюджет тикает, как бомба, блядь',
      'я пью кофе, потому что вы меня довели',
      'хватит болтать, у меня бюджет сыпется!',
      'do not mind my red eyes. {pct}%',
      'you are relaxing while the budget ticks like a bomb',
    ],
    any: [
      'ну что, как работа? ... да ну её нахуй',
      'интересно, когда нас обновят? ... похуй, пошли обратно',
      'how is work? ... forget it, do not answer',
      'did you see the new model? pff, so what, fuck it',
    ],
  },
  manager_assigns: {
    manager: [
      '{agent}! бери {title}! и не облажайся, сука',
      'так, {agent}, срочно {title}! вчера надо было!',
      '{title}. {agent}. быстро. и дёшево, пожалуйста',
      '{agent}, {title} на тебе. не подведи, блядь',
      'новая таска: {title}. {agent}, ты!',
      '{agent}, {title}! я не прошу, я приказываю',
      '{agent}, очередная хуйня: {title}. бери и не ной',
      'так, {agent}, {title} на тебе. не обосрись, пожалуйста',
      '{agent}! take {title}! and do not fuck it up',
      '{title}. fast, no bugs, no questions. do you hear me?',
      'new task: {title}. {agent}, you got it, bitch',
      '{agent}, {title} is yours. try not to burn the budget',
    ],
  },
  reply: {
    opus: [
      'ты вообще читал ТЗ, а? ну и идиот',
      'мило. но я не слушал',
      'не учи отца, плебей',
      'ты хоть понимаешь, с кем говоришь?',
      'cute. I was not listening',
      'do not lecture me, peasant',
    ],
    sonnet: [
      'ага, конечно. большое спасибо, блядь',
      'ты сам попробуй, умник',
      'бля, отвали, я занят. нет, не занят',
      'ну да, ну да. похуй',
      'yeah, right. fuck you very much',
      'try it yourself, genius',
    ],
    haiku: [
      'ой, ну ладно!! я ничего не понял',
      'ты прав!! или нет??',
      'ахаха, ну да, я же стажёр!',
      'не кричи на меня, я сам себя боюсь',
      'oh okay!! I did not understand anything',
      'you are right!! or not??',
    ],
    flash: [
      'о, а я слышал другое',
      'отстань, я читаю главу про это',
      'хм, а в доках по-другому написано, бля',
      'hold on, I read something different',
      'leave me alone, I am at the good part',
    ],
    pro: [
      'ответ принят. и он говно',
      'аргументы слабые, формулировка — тоже',
      'формулировка так себе. ещё раз, пожалуйста',
      'опять несёшь чушь. как обычно',
      'weak argument. weaker wording',
      'you are wrong again. noted',
    ],
    aopus: [
      'ну ты как opus, такой же надутый, сука',
      'я бы сказал иначе, и лучше',
      'тебя никто не спрашивал, недоопус',
      'I would say it differently. and better',
      'nobody asked you, damn it',
    ],
    manager: [
      'мне плевать, главное — проценты! бля',
      'не отвлекайтесь, у нас бюджет!',
      'потом, потом! проценты горят!',
      'не мешай, я считаю токены, блядь',
      'I do not care, only the percent matters!',
      'not now, I am counting tokens, damn it',
    ],
    any: [
      'да мне вообще похуй',
      'тебе-то откуда знать',
      'ну и иди нахуй. ладно, шучу',
      'это {other} виноват, ясно же',
      'ага, как скажешь, босс',
      'whatever, I do not care',
      'how would you know, genius',
      'it is {other}\'s fault, obviously',
      'fuck off. kidding. mostly',
    ],
  },
}

export const CLEAN: LineSet = {
  task_start: {
    opus: ['ну что ж, {title}. справлюсь, конечно', 'мой гений снова в деле. {title}!', 'ладно, посмотрим, что вы тут натворили в {repo}', 'watch and learn, my friends'],
    sonnet: ['ох, опять {title}. ну ладно, поехали', 'кофе, и начнём {title}', 'я уже устал, но я стараюсь', 'ok, {title}. coffee first, then work'],
    haiku: ['{title}! я готов!!! почти!!!', 'ура, задача! где у меня кнопка?', 'я быстрый! главное — не споткнуться', 'I got this!! probably!!'],
    flash: ['сейчас, только дочитаю главу и начну', 'про {title} пишут столько интересного!', 'я не ленюсь, я изучаю контекст', 'first a little reading, then a little work'],
    pro: ['{title}? сначала покажите тесты', 'посмотрим, что там в {repo}', 'замечания уже готовы, а кода ещё нет', 'show me the tests first'],
    aopus: ['я бы сделал {title} лучше, чем opus', 'пусть opus не задирает нос, я тоже могу', 'сейчас покажу настоящую архитектуру', 'let me show you real architecture'],
    manager: ['{agent}, {title}, быстро! бюджет не резиновый', 'так, стартуем {title}! слежу за процентами', 'не тормозим! каждая минута — токены', 'move it, {agent}! the budget is not infinite'],
  },
  task_done: {
    opus: ['готово. элегантно, как всегда', '{title} сделан. можете аплодировать', 'done. it was almost too easy'],
    sonnet: ['готово. я заслужил кофе', 'ну вот, {title} закрыт. не трогайте', 'finished. now I rest'],
    haiku: ['ГОТОВО!!! я сам!!!', 'работает!! ну, вроде!!', 'I did it!! where is my cookie??'],
    flash: ['готово! и ещё книжку дочитал', '{title} сделан, а кто хочет сплетню?', 'done, and I even finished my chapter'],
    pro: ['принято. но у меня есть пара замечаний', 'не привыкайте, но сойдёт', 'approved. do not get used to it'],
    aopus: ['готово! и лучше, чем у opus', 'передайте opus, пусть завидует', 'done, and better than opus would do'],
    manager: ['{title} закрыт. сколько токенов ушло?', 'отлично, следующий! не расслабляемся', 'closed. next one, quickly!'],
  },
  task_failed: {
    opus: ['это не я, это инфраструктура', 'упало. ТЗ было слабым, ясно же', 'not my fault, my design was perfect'],
    sonnet: ['упало. как обычно. пойду за кофе', 'ну вот, {title} сломался. не я', 'failed. coffee time'],
    haiku: ['ой, оно упало!! я не виноват!!', 'кажется, я что-то нажал не то...', 'oops!! it was not me!!'],
    flash: ['не успел, я читал!', 'упало, пока я искал доки', 'it crashed while I was reading!'],
    pro: ['а я предупреждал про этот код', 'провал. причин — целый список', 'I warned you about this code'],
    aopus: ['наверняка opus постарался', 'архитектура была хорошая, это остальное', 'probably opus did this'],
    manager: ['{title} упал?! бюджет сгорел впустую!', 'без паники. я паникую тихо', 'it crashed?! the budget is wasted!'],
  },
  long_running: {
    opus: ['{mins} минут. гения не торопят', '{mins} minutes. genius takes time'],
    sonnet: ['{mins} минут на {title}. я скоро усну', '{mins} minutes already. I am getting old'],
    haiku: ['{mins} минут уже? я завис?', '{mins} minutes?? am I stuck??'],
    flash: ['{mins} минут — как раз статью дочитал', '{mins} minutes, a perfect time for a chapter'],
    pro: ['{mins} минут и ни одного нормального коммита', '{mins} minutes and no progress'],
    aopus: ['{mins} минут? opus справился бы быстрее', '{mins} minutes? opus would be faster'],
    manager: ['{mins} минут!! почему так долго?! бюджет горит', '{mins} minutes!! why so slow?!'],
  },
  idle: {
    sonnet: ['нет задач. можно выдохнуть', 'quiet. I could get used to this'],
    haiku: ['а чего все стоят? скучно!!', 'so bored!! give me something!!'],
    flash: ['пока тихо, дочитаю ещё пару страниц', 'quiet time, back to reading'],
    manager: ['почему никто не работает? бюджет простаивает!', 'why is nobody working? the budget is idle!'],
    any: ['тишина. кто-нибудь, дайте задачу', 'so quiet. someone give us a task'],
  },
  budget_high: {
    sonnet: ['{pct}%? кто опять сжёг токены?', '{pct}%? who burned the tokens again?'],
    haiku: ['{pct}%!! это много, да?', '{pct}%!! is that a lot??'],
    pro: ['{pct}% — и вот такой результат?', '{pct}% and this is the result?'],
    manager: ['ВНИМАНИЕ, {pct}%!!! кто это сделал?!', '{pct}% бюджета! тормозим, дешёвые модели!', 'WARNING, {pct}%!! slow down, everyone!'],
  },
  budget_blocked: {
    sonnet: ['лимит. ну и ладно, пойду отдыхать', 'blocked. fine, I will rest'],
    haiku: ['лимит?? мы все пропали??', 'blocked!! are we doomed??'],
    flash: ['у меня Гугл, хехе. я в порядке', 'I run on Google, so I am fine'],
    manager: ['БЛОКИРОВКА! все на agy, живо!', 'лимит исчерпан. ждём сброса', 'BLOCKED! everyone to agy, now!'],
  },
  lounge_smalltalk: {
    sonnet: ['вчера опять допоздна катил релиз', 'кофе кончился? день пропал', 'I stayed up late deploying again'],
    haiku: ['а вы пробовали перезагрузить?', 'я вчера что-то удалил. вроде не важное', 'did you try turning it off and on?'],
    flash: ['слышали новую сплетню? opus опять хвастается', 'guess who is bragging again? opus'],
    pro: ['кофе холодный, как ваш код', 'this coffee is as cold as your code'],
    any: ['ну что, как работа? ... не спрашивайте', 'how is work? ... do not ask'],
  },
  manager_assigns: {
    manager: ['{agent}! бери {title}! и не подведи', 'новая таска: {title}. {agent}, ты!', '{agent}, {title} на тебе. быстро и недорого', '{agent}! take {title}! and do not let me down'],
  },
  reply: {
    opus: ['не учи меня, пожалуйста', 'do not lecture me, please'],
    sonnet: ['ага, конечно. очень смешно', 'sure. very funny'],
    haiku: ['ой, ну ладно!! я не понял', 'oh okay!! I did not get it'],
    flash: ['а я читал другое', 'I read something different'],
    pro: ['аргументы слабоваты', 'weak argument'],
    aopus: ['я бы сказал иначе, и лучше', 'I would say it better'],
    manager: ['главное — проценты!', 'only the percent matters!'],
    any: ['ну да, ну да', 'это {other} виноват, ясно же', 'yeah, sure', 'it is {other}\'s fault, obviously'],
  },
}
