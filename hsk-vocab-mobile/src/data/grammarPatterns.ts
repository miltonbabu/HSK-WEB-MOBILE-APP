export interface GrammarPattern {
  name: string;
  nameEn: string;
  structure: string;
  level: number;
  keywords: string[];
  examples: string[];
}

export const GRAMMAR_PATTERNS: GrammarPattern[] = [
  {
    name: '虽然…但是',
    nameEn: 'although...but',
    structure: '虽然 + [clause], 但是/可是 + [clause]',
    level: 3,
    keywords: ['虽然', '但是', '可是', 'although', 'but'],
    examples: [
      '虽然很累，但是我还要学习。(Suīrán hěn lèi, dànshì wǒ hái yào xuéxí.) — Although tired, I still need to study.',
      '虽然下雨，但是他去了。(Suīrán xiàyǔ, dànshì tā qù le.) — Although it rained, he went.',
    ],
  },
  {
    name: '不但…而且',
    nameEn: 'not only...but also',
    structure: '不但 + [clause], 而且 + [clause]',
    level: 4,
    keywords: ['不但', '而且', 'not only', 'but also'],
    examples: [
      '他不但聪明，而且努力。(Tā bùdàn cōngmíng, érqiě nǔlì.) — He is not only smart but also hardworking.',
      '她不但会说中文，而且写得很好。(Tā bùdàn huì shuō Zhōngwén, érqiě xiě de hěn hǎo.) — She not only speaks Chinese but also writes well.',
    ],
  },
  {
    name: '越…越',
    nameEn: 'the more...the more',
    structure: '越 + [adj/verb], 越 + [adj/verb]',
    level: 3,
    keywords: ['越', 'the more'],
    examples: [
      '越学越有意思。(Yuè xué yuè yǒu yìsi.) — The more you study, the more interesting it becomes.',
      '天气越来越冷了。(Tiānqì yuè lái yuè lěng le.) — The weather is getting colder and colder.',
    ],
  },
  {
    name: '被字句',
    nameEn: 'passive voice (bèi)',
    structure: '[receiver] + 被 + [doer] + [verb] + [complement]',
    level: 4,
    keywords: ['被', 'passive', 'bèi'],
    examples: [
      '我的手机被偷了。(Wǒ de shǒujī bèi tōu le.) — My phone was stolen.',
      '他被人骗了。(Tā bèi rén piàn le.) — He was cheated by someone.',
    ],
  },
  {
    name: '把字句',
    nameEn: 'disposal construction (bǎ)',
    structure: '[subject] + 把 + [object] + [verb] + [complement]',
    level: 3,
    keywords: ['把', 'disposal', 'bǎ'],
    examples: [
      '我把书放在桌子上了。(Wǒ bǎ shū fàng zài zhuōzi shàng le.) — I put the book on the table.',
      '请把门关上。(Qǐng bǎ mén guān shàng.) — Please close the door.',
    ],
  },
  {
    name: '是…的',
    nameEn: 'emphasis construction',
    structure: '是 + [emphasized element] + (verb) + 的',
    level: 3,
    keywords: ['是', '的', 'emphasis', 'shì...de'],
    examples: [
      '我是昨天来的。(Wǒ shì zuótiān lái de.) — I came yesterday. (emphasizing when)',
      '他是坐飞机去的。(Tā shì zuò fēijī qù de.) — He went by plane. (emphasizing how)',
    ],
  },
  {
    name: '一边…一边',
    nameEn: 'doing two things simultaneously',
    structure: '一边 + [verb phrase], 一边 + [verb phrase]',
    level: 2,
    keywords: ['一边', 'simultaneously', 'while'],
    examples: [
      '他一边吃饭一边看书。(Tā yìbiān chīfàn yìbiān kànshū.) — He eats while reading.',
      '我一边听音乐一边做作业。(Wǒ yìbiān tīng yīnyuè yìbiān zuò zuòyè.) — I listen to music while doing homework.',
    ],
  },
  {
    name: '既然…就',
    nameEn: 'since...then',
    structure: '既然 + [reason], 就 + [result]',
    level: 4,
    keywords: ['既然', '就', 'since'],
    examples: [
      '既然你不舒服，就休息吧。(Jìrán nǐ bù shūfu, jiù xiūxi ba.) — Since you\'re not well, just rest.',
      '既然来了，就坐下来吧。(Jìrán lái le, jiù zuò xiàlái ba.) — Since you\'re here, sit down.',
    ],
  },
  {
    name: '除了…以外',
    nameEn: 'besides/apart from',
    structure: '除了 + [noun/verb phrase] + (以外), [clause]',
    level: 3,
    keywords: ['除了', '以外', 'besides', 'apart from'],
    examples: [
      '除了中文以外，我还学英文。(Chúle Zhōngwén yǐwài, wǒ hái xué Yīngwén.) — Besides Chinese, I also study English.',
      '除了他以外，大家都来了。(Chúle tā yǐwài, dàjiā dōu lái le.) — Apart from him, everyone came.',
    ],
  },
  {
    name: '连…都/也',
    nameEn: 'even',
    structure: '连 + [noun/verb phrase] + 都/也 + [verb]',
    level: 4,
    keywords: ['连', '都', '也', 'even'],
    examples: [
      '这个问题连老师都不会。(Zhège wèntí lián lǎoshī dōu bù huì.) — Even the teacher can\'t answer this question.',
      '他连早饭都没吃就走了。(Tā lián zǎofàn dōu méi chī jiù zǒu le.) — He left without even eating breakfast.',
    ],
  },
  {
    name: '不是…就是',
    nameEn: 'if not...then',
    structure: '不是 + [A], 就是 + [B]',
    level: 4,
    keywords: ['不是', '就是', 'either or'],
    examples: [
      '他不是在家就是在学校。(Tā bú shì zài jiā jiù shì zài xuéxiào.) — He\'s either at home or at school.',
      '周末我不是看书就是看电影。(Zhōumò wǒ bú shì kànshū jiù shì kàn diànyǐng.) — On weekends I either read or watch movies.',
    ],
  },
  {
    name: '只要…就',
    nameEn: 'as long as...then',
    structure: '只要 + [condition], 就 + [result]',
    level: 4,
    keywords: ['只要', '就', 'as long as'],
    examples: [
      '只要努力，就能成功。(Zhǐyào nǔlì, jiù néng chénggōng.) — As long as you work hard, you can succeed.',
      '只要你有时间，我们就去。(Zhǐyào nǐ yǒu shíjiān, wǒmen jiù qù.) — As long as you have time, we\'ll go.',
    ],
  },
  {
    name: '只有…才',
    nameEn: 'only if...then',
    structure: '只有 + [condition], 才 + [result]',
    level: 4,
    keywords: ['只有', '才', 'only if'],
    examples: [
      '只有努力学习，才能通过考试。(Zhǐyǒu nǔlì xuéxí, cái néng tōngguò kǎoshì.) — Only by studying hard can you pass the exam.',
      '只有他才知道答案。(Zhǐyǒu tā cái zhīdào dá\'àn.) — Only he knows the answer.',
    ],
  },
  {
    name: '因为…所以',
    nameEn: 'because...therefore',
    structure: '因为 + [reason], 所以 + [result]',
    level: 2,
    keywords: ['因为', '所以', 'because', 'therefore'],
    examples: [
      '因为下雨，所以我没去。(Yīnwèi xiàyǔ, suǒyǐ wǒ méi qù.) — Because it rained, I didn\'t go.',
      '因为他生病了，所以没来上课。(Yīnwèi tā shēngbìng le, suǒyǐ méi lái shàngkè.) — Because he was sick, he didn\'t come to class.',
    ],
  },
  {
    name: '如果…就',
    nameEn: 'if...then',
    structure: '如果 + [condition], 就 + [result]',
    level: 2,
    keywords: ['如果', '就', 'if', 'then'],
    examples: [
      '如果明天下雨，就不去了。(Rúguǒ míngtiān xiàyǔ, jiù bú qù le.) — If it rains tomorrow, we won\'t go.',
      '如果你有时间，就来吧。(Rúguǒ nǐ yǒu shíjiān, jiù lái ba.) — If you have time, come over.',
    ],
  },

  // ── HSK 1 patterns ──
  {
    name: '是 + noun',
    nameEn: 'is/am/are + noun',
    structure: 'Subject + 是 + Noun',
    level: 1,
    keywords: ['是', 'identity', 'identity sentence'],
    examples: [
      '我是学生。(Wǒ shì xuéshēng.) — I am a student.',
      '他是我的朋友。(Tā shì wǒ de péngyou.) — He is my friend.',
    ],
  },
  {
    name: '有 + noun',
    nameEn: 'to have',
    structure: 'Subject + 有 + Noun',
    level: 1,
    keywords: ['有', 'have', 'possession'],
    examples: [
      '我有一只猫。(Wǒ yǒu yì zhī māo.) — I have a cat.',
      '她有两个哥哥。(Tā yǒu liǎng ge gēge.) — She has two older brothers.',
    ],
  },
  {
    name: '吗 question',
    nameEn: 'yes/no question particle',
    structure: 'Statement + 吗?',
    level: 1,
    keywords: ['吗', 'question', 'yes/no'],
    examples: [
      '你是中国人吗？(Nǐ shì Zhōngguó rén ma?) — Are you Chinese?',
      '你喜欢喝咖啡吗？(Nǐ xǐhuān hē kāfēi ma?) — Do you like drinking coffee?',
    ],
  },
  {
    name: '了 (change)',
    nameEn: 'change of state',
    structure: 'Subject + Verb + 了',
    level: 1,
    keywords: ['了', 'le', 'change of state'],
    examples: [
      '我累了。(Wǒ lèi le.) — I\'m tired now.',
      '下雨了。(Xià yǔ le.) — It started raining.',
    ],
  },
  {
    name: '的 possession',
    nameEn: '\'s / of',
    structure: 'Noun A + 的 + Noun B',
    level: 1,
    keywords: ['的', 'de', 'possession', 'attributive'],
    examples: [
      '我的书在桌子上。(Wǒ de shū zài zhuōzi shàng.) — My book is on the table.',
      '他是中国的老师。(Tā shì Zhōngguó de lǎoshī.) — He is a teacher from China.',
    ],
  },
  {
    name: '太…了',
    nameEn: 'too + adj',
    structure: '太 + Adj + 了',
    level: 1,
    keywords: ['太', 'too', 'excessively'],
    examples: [
      '今天太热了。(Jīntiān tài rè le.) — It\'s too hot today.',
      '这个太贵了。(Zhège tài guì le.) — This is too expensive.',
    ],
  },
  {
    name: '很 + adj',
    nameEn: 'very + adj',
    structure: 'Subject + 很 + Adjective',
    level: 1,
    keywords: ['很', 'very', 'adjective'],
    examples: [
      '她很漂亮。(Tā hěn piàoliang.) — She is very pretty.',
      '这个苹果很大。(Zhège píngguǒ hěn dà.) — This apple is very big.',
    ],
  },
  {
    name: '在 + place',
    nameEn: 'to be at (location)',
    structure: 'Subject + 在 + Place',
    level: 1,
    keywords: ['在', 'at', 'location', 'zài'],
    examples: [
      '我在家。(Wǒ zài jiā.) — I am at home.',
      '图书馆在学校对面。(Túshūguǎn zài xuéxiào duìmiàn.) — The library is opposite the school.',
    ],
  },

  // ── HSK 2 patterns ──
  {
    name: '想 + verb',
    nameEn: 'want to / would like to',
    structure: 'Subject + 想 + Verb',
    level: 2,
    keywords: ['想', 'want', 'xiǎng'],
    examples: [
      '我想喝水。(Wǒ xiǎng hē shuǐ.) — I want to drink water.',
      '他想去中国。(Tā xiǎng qù Zhōngguó.) — He wants to go to China.',
    ],
  },
  {
    name: '会 + verb',
    nameEn: 'know how to / can (skill)',
    structure: 'Subject + 会 + Verb',
    level: 2,
    keywords: ['会', 'can', 'skill', 'huì'],
    examples: [
      '我会说中文。(Wǒ huì shuō Zhōngwén.) — I can speak Chinese.',
      '她会弹钢琴。(Tā huì tán gāngqín.) — She can play the piano.',
    ],
  },
  {
    name: '能 + verb',
    nameEn: 'can / be able to',
    structure: 'Subject + 能 + Verb',
    level: 2,
    keywords: ['能', 'can', 'néng', 'ability'],
    examples: [
      '我能帮你吗？(Wǒ néng bāng nǐ ma?) — Can I help you?',
      '今晚我不能去。(Jīn wǎn wǒ bù néng qù.) — I can\'t go tonight.',
    ],
  },
  {
    name: '可以 + verb',
    nameEn: 'may / can (permission)',
    structure: 'Subject + 可以 + Verb',
    level: 2,
    keywords: ['可以', 'can', 'may', 'permission', 'kěyǐ'],
    examples: [
      '可以借你的笔吗？(Kěyǐ jiè nǐ de bǐ ma?) — May I borrow your pen?',
      '这里可以拍照。(Zhèlǐ kěyǐ pāizhào.) — You can take photos here.',
    ],
  },
  {
    name: '要 + verb',
    nameEn: 'want to / be going to',
    structure: 'Subject + 要 + Verb',
    level: 2,
    keywords: ['要', 'want', 'yào', 'future'],
    examples: [
      '我要去商店。(Wǒ yào qù shāngdiàn.) — I\'m going to the store.',
      '你要吃什么？(Nǐ yào chī shénme?) — What do you want to eat?',
    ],
  },
  {
    name: '比 comparison',
    nameEn: 'comparative with 比',
    structure: 'A + 比 + B + Adj',
    level: 2,
    keywords: ['比', 'compare', 'bǐ', 'comparative'],
    examples: [
      '我比你高。(Wǒ bǐ nǐ gāo.) — I am taller than you.',
      '今天比昨天冷。(Jīntiān bǐ zuótiān lěng.) — Today is colder than yesterday.',
    ],
  },
  {
    name: '得 complement',
    nameEn: 'complement of degree',
    structure: 'Verb + 得 + Adjective',
    level: 2,
    keywords: ['得', 'de', 'complement', 'degree'],
    examples: [
      '她唱得很好。(Tā chàng de hěn hǎo.) — She sings very well.',
      '他跑得很快。(Tā pǎo de hěn kuài.) — He runs very fast.',
    ],
  },
  {
    name: '从…到',
    nameEn: 'from...to',
    structure: '从 + Place/Time + 到 + Place/Time',
    level: 2,
    keywords: ['从', '到', 'from', 'to', 'cóng', 'dào'],
    examples: [
      '我从北京来。(Wǒ cóng Běijīng lái.) — I come from Beijing.',
      '从早到晚。(Cóng zǎo dào wǎn.) — From morning till night.',
    ],
  },
  {
    name: '给 + person + verb',
    nameEn: 'give / do something for someone',
    structure: 'Subject + 给 + Person + Verb',
    level: 2,
    keywords: ['给', 'give', 'for', 'gěi'],
    examples: [
      '我给他一本书。(Wǒ gěi tā yì běn shū.) — I gave him a book.',
      '请给我一杯水。(Qǐng gěi wǒ yì bēi shuǐ.) — Please give me a glass of water.',
    ],
  },

  // ── HSK 3 patterns ──
  {
    name: '是 + adj + 的',
    nameEn: 'emphatic adjective sentence',
    structure: '是 + Adj + 的 (emphatic)',
    level: 3,
    keywords: ['是', '的', 'emphatic', 'shì...de'],
    examples: [
      '他是认真的。(Tā shì rènzhēn de.) — He is serious (emphasis).',
      '这件事是重要的。(Zhè jiàn shì shì zhòngyào de.) — This matter is important (emphasis).',
    ],
  },
  {
    name: '过 (experience)',
    nameEn: 'experience particle',
    structure: 'Verb + 过',
    level: 3,
    keywords: ['过', 'guò', 'experience', 'past'],
    examples: [
      '我去过中国。(Wǒ qù guò Zhōngguó.) — I have been to China.',
      '你吃过北京烤鸭吗？(Nǐ chī guò Běijīng kǎoyā ma?) — Have you eaten Beijing roast duck?',
    ],
  },
  {
    name: '正在 + verb',
    nameEn: 'progressive aspect',
    structure: 'Subject + 正在 + Verb',
    level: 3,
    keywords: ['正在', 'progressive', 'now', 'zhèngzài'],
    examples: [
      '我正在看书。(Wǒ zhèngzài kànshū.) — I am reading.',
      '她正在做饭。(Tā zhèngzài zuòfàn.) — She is cooking.',
    ],
  },
  {
    name: '着 (state)',
    nameEn: 'continuous state',
    structure: 'Verb + 着 (+ Noun)',
    level: 3,
    keywords: ['着', 'zhe', 'state', 'continuous'],
    examples: [
      '门开着。(Mén kāi zhe.) — The door is open.',
      '他戴着一副眼镜。(Tā dài zhe yí fù yǎnjìng.) — He is wearing glasses.',
    ],
  },
  {
    name: '好像',
    nameEn: 'seems like / as if',
    structure: 'Subject + 好像 + Clause',
    level: 3,
    keywords: ['好像', 'seems', 'hǎoxiàng'],
    examples: [
      '他好像不太高兴。(Tā hǎoxiàng bú tài gāoxìng.) — He seems not very happy.',
      '今天好像要下雨。(Jīntiān hǎoxiàng yào xiàyǔ.) — It looks like it will rain today.',
    ],
  },
  {
    name: '可能',
    nameEn: 'probably / might',
    structure: 'Subject + 可能 + Verb',
    level: 3,
    keywords: ['可能', 'probably', 'kěnéng'],
    examples: [
      '他可能迟到了。(Tā kěnéng chídào le.) — He is probably late.',
      '明天可能很冷。(Míngtiān kěnéng hěn lěng.) — Tomorrow might be very cold.',
    ],
  },
  {
    name: '应该',
    nameEn: 'should / ought to',
    structure: 'Subject + 应该 + Verb',
    level: 3,
    keywords: ['应该', 'should', 'yīnggāi'],
    examples: [
      '你应该早点睡觉。(Nǐ yīnggāi zǎo diǎn shuìjiào.) — You should sleep earlier.',
      '我们应该说中文。(Wǒmen yīnggāi shuō Zhōngwén.) — We should speak Chinese.',
    ],
  },
  {
    name: '得 (must)',
    nameEn: 'must / have to',
    structure: 'Subject + 得 + Verb',
    level: 3,
    keywords: ['得', 'děi', 'must', 'have to'],
    examples: [
      '我得走了。(Wǒ děi zǒu le.) — I have to go now.',
      '你得快点。(Nǐ děi kuài diǎn.) — You have to be quicker.',
    ],
  },
  {
    name: '让 + sb + verb',
    nameEn: 'let / make (someone do something)',
    structure: 'Subject + 让 + Person + Verb',
    level: 3,
    keywords: ['让', 'let', 'ràng', 'cause'],
    examples: [
      '妈妈让我吃饭。(Māma ràng wǒ chīfàn.) — Mom made me eat.',
      '别让他知道。(Bié ràng tā zhīdào.) — Don\'t let him know.',
    ],
  },
  {
    name: '叫 + sb + verb',
    nameEn: 'ask / tell (someone to do)',
    structure: 'Subject + 叫 + Person + Verb',
    level: 3,
    keywords: ['叫', 'ask', 'tell', 'jiào'],
    examples: [
      '老师叫我们读书。(Lǎoshī jiào wǒmen dúshū.) — The teacher told us to read.',
      '妈妈叫我去睡觉。(Māma jiào wǒ qù shuìjiào.) — Mom told me to go to sleep.',
    ],
  },
  {
    name: '请 + verb',
    nameEn: 'please (polite request)',
    structure: '请 + Verb',
    level: 3,
    keywords: ['请', 'please', 'qǐng', 'polite'],
    examples: [
      '请坐。(Qǐng zuò.) — Please sit down.',
      '请再说一遍。(Qǐng zài shuō yí biàn.) — Please say it again.',
    ],
  },
  {
    name: '跟 + person + verb',
    nameEn: 'with / and (person)',
    structure: 'Subject + 跟 + Person + Verb',
    level: 3,
    keywords: ['跟', 'with', 'and', 'gēn'],
    examples: [
      '我跟他一起去。(Wǒ gēn tā yìqǐ qù.) — I\'ll go with him.',
      '我跟他学中文。(Wǒ gēn tā xué Zhōngwén.) — I learn Chinese from him.',
    ],
  },
  {
    name: '对 + person + adj',
    nameEn: 'towards / opinion',
    structure: 'Subject + 对 + Person/Noun + Adjective',
    level: 3,
    keywords: ['对', 'towards', 'duì', 'opinion'],
    examples: [
      '他对我很好。(Tā duì wǒ hěn hǎo.) — He is very nice to me.',
      '我对这个很感兴趣。(Wǒ duì zhège hěn gǎn xìngqù.) — I\'m very interested in this.',
    ],
  },

  // ── HSK 4 patterns ──
  {
    name: '越来越',
    nameEn: 'more and more',
    structure: '越来越 + Adj',
    level: 4,
    keywords: ['越来越', 'more and more', 'yuè lái yuè'],
    examples: [
      '天气越来越热。(Tiānqì yuè lái yuè rè.) — The weather is getting hotter and hotter.',
      '他越来越忙了。(Tā yuè lái yuè máng le.) — He is getting busier and busier.',
    ],
  },
  {
    name: '既…又',
    nameEn: 'both…and',
    structure: '既 + Adj/Verb, 又 + Adj/Verb',
    level: 4,
    keywords: ['既', '又', 'both', 'and', 'jì...yòu'],
    examples: [
      '她既聪明又漂亮。(Tā jì cōngmíng yòu piàoliang.) — She is both smart and pretty.',
      '这个菜既好吃又便宜。(Zhège cài jì hǎochī yòu piányí.) — This dish is both tasty and cheap.',
    ],
  },
  {
    name: '又…又',
    nameEn: 'both…and (adjectives)',
    structure: '又 + Adj, 又 + Adj',
    level: 4,
    keywords: ['又', 'both', 'and', 'yòu...yòu'],
    examples: [
      '她又高又瘦。(Tā yòu gāo yòu shòu.) — She is both tall and thin.',
      '这个房间又大又亮。(Zhège fángjiān yòu dà yòu liàng.) — This room is both big and bright.',
    ],
  },
  {
    name: '不管…都/也',
    nameEn: 'no matter…still',
    structure: '不管 + (clause), 都/也 + (clause)',
    level: 4,
    keywords: ['不管', '都', '也', 'no matter', 'bùguǎn'],
    examples: [
      '不管多忙，我都会来。(Bùguǎn duō máng, wǒ dōu huì lái.) — No matter how busy, I\'ll come.',
      '不管你说什麽，我都不信。(Bùguǎn nǐ shuō shénme, wǒ dōu bù xìn.) — No matter what you say, I won\'t believe it.',
    ],
  },
  {
    name: '一…就',
    nameEn: 'as soon as…then',
    structure: '一 + Verb, 就 + Verb',
    level: 4,
    keywords: ['一', '就', 'as soon as', 'yī...jiù'],
    examples: [
      '我一到学校就开始上课。(Wǒ yí dào xuéxiào jiù kāishǐ shàngkè.) — As soon as I arrive at school, class begins.',
      '他一回家就睡觉。(Tā yì huí jiā jiù shuìjiào.) — He sleeps as soon as he gets home.',
    ],
  },
  {
    name: '为了',
    nameEn: 'in order to / for the sake of',
    structure: '为了 + Goal/Purpose',
    level: 4,
    keywords: ['为了', 'in order to', 'wèile'],
    examples: [
      '为了健康，我每天跑步。(Wèile jiànkāng, wǒ měitiān pǎobù.) — For health, I run every day.',
      '他为了她学了中文。(Tā wèile tā xué le Zhōngwén.) — He learned Chinese for her.',
    ],
  },
  {
    name: '因为…而',
    nameEn: 'because…(formal)',
    structure: '因为 + Reason + 而 + Result',
    level: 4,
    keywords: ['因为', '而', 'because', 'yīnwèi...ér'],
    examples: [
      '他因为生病而没来。(Tā yīnwèi shēngbìng ér méi lái.) — He didn\'t come because of illness.',
      '她因为努力而成功。(Tā yīnwèi nǔlì ér chénggōng.) — She succeeded because of hard work.',
    ],
  },
  {
    name: '即使…也',
    nameEn: 'even if…still',
    structure: '即使 + Condition, 也 + Result',
    level: 4,
    keywords: ['即使', '也', 'even if', 'jíshǐ'],
    examples: [
      '即使很累，我也要做完。(Jíshǐ hěn lèi, wǒ yě yào zuò wán.) — Even if tired, I must finish.',
      '即使下雨，我们也要去。(Jíshǐ xiàyǔ, wǒmen yě yào qù.) — Even if it rains, we\'ll go.',
    ],
  },
  {
    name: '虽然…但',
    nameEn: 'although…yet',
    structure: '虽然 + Concession, 但 + Result',
    level: 4,
    keywords: ['虽然', '但', 'although', 'suīrán...dàn'],
    examples: [
      '虽然很贵，但我还是要买。(Suīrán hěn guì, dàn wǒ háishi yào mǎi.) — Although expensive, I still want to buy it.',
      '虽然他不高，但他很帅。(Suīrán tā bù gāo, dàn tā hěn shuài.) — Although he\'s not tall, he\'s handsome.',
    ],
  },
  {
    name: '为了…而',
    nameEn: 'in order to…(formal)',
    structure: '为了 + Goal, 而 + Action',
    level: 4,
    keywords: ['为了', '而', 'in order to', 'wèile...ér'],
    examples: [
      '他为了梦想而努力。(Tā wèile mèngxiǎng ér nǔlì.) — He works hard for his dream.',
      '我们为了和平而战。(Wǒmen wèile hépíng ér zhàn.) — We fight for peace.',
    ],
  },
  {
    name: '除非…否则',
    nameEn: 'unless…otherwise',
    structure: '除非 + Condition, 否则 + Result',
    level: 4,
    keywords: ['除非', '否则', 'unless', 'chúfēi...fǒuzé'],
    examples: [
      '除非你来，否则我不走。(Chúfēi nǐ lái, fǒuzé wǒ bù zǒu.) — I won\'t leave unless you come.',
      '除非下雨，否则我们去。(Chúfēi xiàyǔ, fǒuzé wǒmen qù.) — We\'ll go unless it rains.',
    ],
  },
  {
    name: '无论…都/也',
    nameEn: 'no matter…(formal)',
    structure: '无论 + Question Word, 都/也 + Result',
    level: 4,
    keywords: ['无论', '都', '也', 'no matter', 'wúlùn'],
    examples: [
      '无论你去哪，我都跟你。(Wúlùn nǐ qù nǎ, wǒ dōu gēn nǐ.) — Wherever you go, I\'ll follow.',
      '无论多难，我都要做。(Wúlùn duō nán, wǒ dōu yào zuò.) — No matter how hard, I\'ll do it.',
    ],
  },
  {
    name: '既…也',
    nameEn: 'both…also',
    structure: '既 + A, 也 + B',
    level: 4,
    keywords: ['既', '也', 'both', 'jì...yě'],
    examples: [
      '他既会中文，也会英文。(Tā jì huì Zhōngwén, yě huì Yīngwén.) — He knows both Chinese and English.',
      '这里既安静，也漂亮。(Zhèlǐ jì ānjìng, yě piàoliang.) — This place is both quiet and pretty.',
    ],
  },
  {
    name: '与 / 和 / 跟 + noun',
    nameEn: 'and / with (connecting nouns)',
    structure: 'Noun + 与/和/跟 + Noun',
    level: 4,
    keywords: ['与', '和', '跟', 'and', 'with', 'yǔ', 'hé', 'gēn'],
    examples: [
      '我与他意见不同。(Wǒ yǔ tā yìjiàn bùtóng.) — I have a different opinion from him.',
      '我跟她谈过了。(Wǒ gēn tā tán guò le.) — I\'ve talked with her.',
    ],
  },
  {
    name: '不是…而是',
    nameEn: 'not…but (correction)',
    structure: '不是 + A, 而是 + B',
    level: 4,
    keywords: ['不是', '而是', 'not but', 'búshì...érshì'],
    examples: [
      '我不是不喜欢，而是没时间。(Wǒ bú shì bù xǐhuān, érshì méi shíjiān.) — It\'s not that I don\'t like it, I have no time.',
      '他不是学生，而是老师。(Tā bú shì xuéshēng, érshì lǎoshī.) — He is not a student, but a teacher.',
    ],
  },
  {
    name: '即使…还是',
    nameEn: 'even if…still (emphatic)',
    structure: '即使 + Condition, 还是 + Result',
    level: 4,
    keywords: ['即使', '还是', 'even if', 'jíshǐ...háishi'],
    examples: [
      '即使他说对不起，我还是生气。(Jíshǐ tā shuō duìbuqǐ, wǒ háishi shēngqì.) — Even if he apologizes, I\'m still angry.',
      '即使再难，我还是要试。(Jíshǐ zài nán, wǒ háishi yào shì.) — Even if it\'s hard, I\'ll still try.',
    ],
  },
  {
    name: '趁 + clause',
    nameEn: 'while (take advantage of)',
    structure: '趁 + [opportunity/time], Verb',
    level: 4,
    keywords: ['趁', 'while', 'chèn', 'opportunity'],
    examples: [
      '趁年轻，多学一点。(Chèn niánqīng, duō xué yì diǎn.) — While young, learn more.',
      '趁天还没黑，我们走吧。(Chèn tiān hái méi hēi, wǒmen zǒu ba.) — Let\'s go while it\'s still light.',
    ],
  },
  {
    name: '免得',
    nameEn: 'lest / so as to avoid',
    structure: 'Verb + 免得 + Negative Result',
    level: 4,
    keywords: ['免得', 'lest', 'avoid', 'miǎnde'],
    examples: [
      '快点走吧，免得迟到。(Kuài diǎn zǒu ba, miǎnde chídào.) — Hurry up, lest you be late.',
      '带把伞吧，免得淋雨。(Dài bǎ sǎn ba, miǎnde lín yǔ.) — Bring an umbrella, lest you get wet.',
    ],
  },
  {
    name: '因此',
    nameEn: 'therefore / for this reason',
    structure: '因 + Reason + 因此 + Result',
    level: 4,
    keywords: ['因此', 'therefore', 'yīncǐ'],
    examples: [
      '他没复习，因此考试没及格。(Tā méi fùxí, yīncǐ kǎoshì méi jígé.) — He didn\'t review, therefore he failed the exam.',
      '堵车了，因此我迟到了。(Dǔchē le, yīncǐ wǒ chídào le.) — Traffic jam, so I was late.',
    ],
  },
  {
    name: '随着',
    nameEn: 'along with / as (change)',
    structure: '随着 + Noun + Verb/Adj',
    level: 4,
    keywords: ['随着', 'along with', 'as', 'suízhe'],
    examples: [
      '随着时间的变化，天气也变了。(Suízhe shíjiān de biànhuà, tiānqì yě biàn le.) — As time changes, so does the weather.',
      '随着经济的发展，人们的生活变好了。(Suízhe jīngjì de fāzhǎn, rénmen de shēnghuó biàn hǎo le.) — With economic development, people\'s lives improved.',
    ],
  },
  {
    name: '凡是…都',
    nameEn: 'all that…all',
    structure: '凡是 + Category, 都 + Result',
    level: 4,
    keywords: ['凡是', '都', 'all', 'fánshì'],
    examples: [
      '凡是他说的，我都听。(Fánshì tā shuō de, wǒ dōu tīng.) — Whatever he says, I listen.',
      '凡是来这里的客人都很满意。(Fánshì lái zhèlǐ de kèrén dōu hěn mǎnyì.) — All guests who come here are satisfied.',
    ],
  },
  {
    name: '宁可…也不',
    nameEn: 'would rather…than',
    structure: '宁可 + A, 也不 + B',
    level: 4,
    keywords: ['宁可', '也不', 'would rather', 'nìngkě'],
    examples: [
      '我宁可走路，也不坐这么慢的车。(Wǒ nìngkě zǒulù, yě bú zuò zhème màn de chē.) — I\'d rather walk than take such a slow bus.',
      '他宁可加班，也不让别人帮忙。(Tā nìngkě jiābān, yě bú ràng biérén bāngmáng.) — He\'d rather work overtime than let others help.',
    ],
  },
  {
    name: '没…就',
    nameEn: 'as soon as / once',
    structure: '没 + Verb, 就 + Verb',
    level: 4,
    keywords: ['没', '就', 'once', 'as soon as', 'méi'],
    examples: [
      '他没到家，就给我打电话。(Tā méi dào jiā, jiù gěi wǒ dǎ diànhuà.) — He called me as soon as he got home.',
      '我没看完，就说喜欢了。(Wǒ méi kàn wán, jiù shuō xǐhuān le.) — I said I liked it before even finishing.',
    ],
  },
];

export const PATTERN_BY_NAME: Record<string, GrammarPattern> = GRAMMAR_PATTERNS.reduce(
  (acc, p) => ({ ...acc, [p.name]: p }),
  {} as Record<string, GrammarPattern>
);