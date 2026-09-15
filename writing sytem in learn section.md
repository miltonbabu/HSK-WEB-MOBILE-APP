TASK:
Build a complete production-ready "Chinese Writing Practice" feature inside my EXISTING HSK Chinese-learning web app.

IMPORTANT:
This is NOT a request to create a separate demo, separate project, or prototype.

You must first inspect and understand the existing application architecture, UI system, authentication, database schema, HSK vocabulary data, API structure, routing, state management, and existing components.

Then integrate this feature cleanly into the existing application without breaking any existing functionality.

==================================================
1. FIRST: INSPECT THE EXISTING APP
==================================================

Before writing code:

1. Inspect the complete project structure.
2. Identify:
   - frontend framework
   - backend/API architecture
   - database
   - authentication
   - existing HSK vocabulary tables/data
   - existing HSK 1–4 vocabulary
   - existing user/profile system
   - existing learning/progress/statistics system
   - existing UI components
   - existing design system
   - existing routing/navigation
   - existing API patterns
   - existing environment variables
   - existing rate-limiting system
   - existing AI integration
3. Find how HSK vocabulary is currently stored and queried.
4. Reuse the existing vocabulary system instead of creating duplicate HSK word data.
5. Find the existing app's styling conventions and follow them.
6. Find the existing responsive/mobile behavior and preserve it.
7. Do NOT replace the existing architecture just because you prefer another stack.
8. Do NOT rewrite unrelated parts of the application.
9. Do NOT remove existing features.
10. Do NOT create duplicate authentication, database, or API systems.

Before implementation, create a short internal implementation plan based on the actual repository.

==================================================
2. FEATURE NAME
==================================================

Add:

Chinese Writing Practice
汉字书写练习

Suggested navigation:

Learn
 ├── Vocabulary
 ├── Flashcards
 ├── Quiz
 └── Writing Practice

Use the existing app's naming conventions if different.

==================================================
3. CORE PURPOSE
==================================================

The feature allows users to practice producing Chinese words and sentences.

Users already have approximately 2,000 HSK vocabulary words covering HSK 1–4 in the existing application.

The writing system must use this existing vocabulary.

Users should be able to:

- select HSK level
- select practice scope
- select writing mode
- choose sequential/random practice
- choose number of questions
- practice vocabulary
- practice AI-generated sentences
- type Chinese using an integrated Pinyin IME-style keyboard
- submit answers
- receive correctness results
- see character-level mistakes
- see expected vs actual answers
- track writing performance
- repeat weak words

==================================================
4. HSK LEVEL SELECTION
==================================================

Support:

- HSK 1
- HSK 2
- HSK 3
- HSK 4

Also support cumulative levels where appropriate:

- HSK 1–2
- HSK 1–3
- HSK 1–4

However, only show cumulative options if they fit the existing app's HSK structure.

Important:

If the user selects a level, sentence generation must respect that level.

Example:

HSK 2 practice should primarily use HSK 1–2 vocabulary.

Do NOT randomly introduce advanced HSK 5/6 vocabulary.

==================================================
5. PRACTICE MODES
==================================================

Implement these writing modes:

MODE 1:
English + Pinyin → Chinese

Example:

Meaning:
to study

Pinyin:
xuéxí

User must type:

学习


MODE 2:
Pinyin → Chinese

Example:

xuéxí

User must type:

学习


MODE 3:
English → Chinese

Example:

to study

User must type:

学习


MODE 4:
Chinese + Pinyin → Chinese

Example:

学习
xuéxí

User must reproduce:

学习


MODE 5:
Chinese → Chinese

Example:

学习

User must reproduce:

学习


MODE 6:
Sentence Writing

AI-generated sentence exercise.

Example:

English:
I study Chinese every day.

Pinyin:
Wǒ měitiān xuéxí Zhōngwén.

User must write:

我每天学习中文。

The exact available modes should be controlled through the UI configuration.

==================================================
6. PRACTICE ORDER
==================================================

Support:

- Sequential
- Random

Also architect the system so it can later support:

- Weak words
- Incorrect words
- Not practiced
- Recently practiced

Do not implement unnecessary future features if they complicate V1, but keep the architecture extensible.

Sequential example:

HSK 2 vocabulary:
word 1
word 2
word 3
word 4
...

Random example:

Select random vocabulary from the selected level.

Ensure that the same question is not repeatedly selected within a session unless the available vocabulary pool is smaller than the requested number.

==================================================
7. QUESTION COUNT
==================================================

Allow users to select:

- 10
- 20
- 30
- 50
- 100
- All

Only display options that make sense based on the available vocabulary.

==================================================
8. WRITING PRACTICE SCREEN
==================================================

Create a clean focused practice interface.

Example structure:

--------------------------------------------------

HSK 2                         7 / 20

Progress bar

--------------------------------------------------

Write the Chinese

to study

xuéxí

--------------------------------------------------

[ User input ]

--------------------------------------------------

Chinese candidate suggestions

1. 学习
2. 学
3. 习
...

--------------------------------------------------

[ Chinese Pinyin Keyboard ]

--------------------------------------------------

[ Check ]

--------------------------------------------------

Important UX:

- Keep the question visually prominent.
- Keep distractions low.
- Make the input area large.
- Make the experience comfortable on desktop and mobile.
- Support physical keyboard input.
- Support clicking the on-screen keyboard.
- Support Enter to submit.
- Support Backspace.
- Do not introduce excessive animations.
- Follow the existing application's design language.

==================================================
9. INTEGRATED CHINESE PINYIN IME
==================================================

This is one of the most important requirements.

Build an integrated Chinese Pinyin input system inside the application.

Users should NOT need to install a Chinese keyboard to use the feature.

Example:

User physically types:

wo

The application displays candidate Chinese characters:

1. 我
2. 喔
3. 沃
4. 窝
5. 握
6. 倭
7. 卧

The user can:

- click a candidate
- press 1–9
- use Arrow Up
- use Arrow Down
- use Arrow Left
- use Arrow Right
- press Space
- press Enter
- press Backspace

==================================================
10. IMPORTANT: BUILD A REAL IME-LIKE SYSTEM
==================================================

Do NOT hard-code simple mappings such as:

wo = 我, 喔, 沃...

The system must be data-driven.

Create an IME dictionary/data layer capable of handling:

- Pinyin syllables
- Chinese characters
- words
- common phrases
- candidate ranking

Architecture:

User Pinyin Input
        ↓
Pinyin parser
        ↓
IME dictionary
        ↓
Candidate ranking
        ↓
Candidate selector
        ↓
Chinese output

Example:

Input:

nihao

Possible candidate:

1. 你好
2. 你号
3. 尼好
...

The system should prioritize common Chinese words and phrases.

==================================================
11. PHRASE-AWARE CANDIDATES
==================================================

The IME should preferably support phrase-level conversion.

Example:

User types:

wo xihuan zhongguo

Prefer:

我喜欢中国

instead of only showing individual character candidates.

Candidate engine should support:

- single characters
- words
- multi-character phrases
- common sentence fragments

Candidate ranking should prioritize:

1. exact/common phrase
2. frequency/common usage
3. context when available
4. individual character alternatives

==================================================
12. DO NOT AUTOMATICALLY CONVERT EVERYTHING
==================================================

The user is practicing Chinese writing.

Do NOT simply convert:

xuexi

automatically into:

学习

without user interaction.

The user should be responsible for selecting Chinese candidates.

Track:

raw Pinyin input
selected Chinese characters/words
final answer

This is important for learning analytics.

==================================================
13. PHYSICAL KEYBOARD SUPPORT
==================================================

The writing input must work with a normal laptop keyboard.

Examples:

User types:

nihao

Candidate list appears.

User presses:

1

→ select first candidate.

User presses:

Space

→ select candidate / confirm composition.

User presses:

Backspace

→ remove the previous Pinyin/composition character.

User presses:

Arrow keys

→ navigate candidates where appropriate.

User presses:

Enter

→ submit answer when no candidate composition is active.

Be careful not to hijack normal browser keyboard shortcuts.

Handle keyboard events cleanly.

==================================================
14. MOBILE SUPPORT
==================================================

The writing practice must be fully responsive.

On mobile:

- show the integrated keyboard
- make candidate buttons touch-friendly
- make the answer field large
- avoid tiny controls
- support native mobile keyboard if appropriate
- allow switching between native keyboard and app Pinyin IME if technically appropriate

Desktop:

- support physical keyboard
- show integrated keyboard

==================================================
15. VOCABULARY DATA
==================================================

Reuse the existing HSK vocabulary database.

Do NOT create a second copy of the 2,000 vocabulary words.

Use existing fields when available:

- word
- simplified Chinese
- pinyin
- English meaning
- HSK level
- word ID

If the existing schema uses different names, adapt to it.

Create database indexes if necessary for efficient:

- HSK-level filtering
- random selection
- vocabulary lookup
- writing statistics

==================================================
16. ANSWER EVALUATION
==================================================

Vocabulary evaluation:

Expected:

学习

User:

学习

Result:

100% correct


For sentences, do NOT only use a naive exact string comparison.

Normalize:

- unnecessary spaces
- common whitespace differences
- full-width/half-width punctuation where appropriate
- harmless punctuation differences if the exercise allows it

But DO NOT normalize away actual Chinese character mistakes.

Example:

Expected:

我每天学习中文。

User:

我每天学习中国。

Result:

Not fully correct.

Show:

Expected:
我每天学习中文。

Your answer:
我每天学习中国。

Differences:

中国 → 中文

==================================================
17. CHARACTER-LEVEL EVALUATION
==================================================

For incorrect answers, show useful feedback.

Example:

Expected:

我每天学习中文。

User:

我每天学习中国。

Display something like:

5 / 7 characters correct

✓ 我
✓ 每
✓ 天
✓ 学
✓ 习
✓ 中
✗ 国

Correct:
我每天学习中文。

Your answer:
我每天学习中国。

Do not make the UI visually overwhelming.

Use the existing app design system.

==================================================
18. RESULT SCREEN
==================================================

After finishing a session show:

- total questions
- correct answers
- incorrect answers
- accuracy percentage
- average response time
- session duration
- words practiced
- weak words
- character mistakes
- optionally streak/progress if the existing app already supports it

Example:

Writing Practice Complete

Accuracy
86%

Correct
17 / 20

Average time
8.4 sec

Weak words
学习
觉得
知道

[ Review Mistakes ]

[ Practice Again ]

==================================================
19. MISTAKE REVIEW
==================================================

Create a review mode.

Example:

Mistake #1

Prompt:
to study

Your answer:
学西

Correct answer:
学习

Pinyin:
xuéxí

[ Practice Again ]

Allow the user to practice only mistakes after a session.

==================================================
20. USER PROGRESS
==================================================

Integrate with the existing user learning/progress system if one exists.

Store writing performance.

Recommended data model:

writing_sessions

- id
- user_id
- hsk_level
- scope
- practice_mode
- order_type
- question_count
- correct_count
- accuracy
- started_at
- completed_at

writing_attempts

- id
- session_id
- user_id
- word_id nullable
- question_type
- expected_answer
- user_answer
- pinyin_input
- is_correct
- accuracy
- time_taken
- mistakes
- created_at

Adapt this to the existing database schema.

Do NOT blindly create duplicate user/stat tables.

==================================================
21. CHARACTER/WORD WEAKNESS TRACKING
==================================================

Track repeated mistakes.

Example:

学习:
5 attempts
2 correct
60% accuracy

觉:
8 attempts
3 correct
37.5% accuracy

This allows future:

Weak Words

Weak Characters

Adaptive Practice

Keep the database architecture ready for this.

==================================================
22. AI SENTENCE GENERATION
==================================================

Use AI ONLY where it provides value.

Vocabulary questions should come directly from the existing HSK vocabulary database.

AI should mainly generate sentence-writing exercises.

Pipeline:

Existing HSK vocabulary
        ↓
Select target vocabulary
        ↓
AI generates sentence
        ↓
Validate
        ↓
Store/cache
        ↓
Show to user

==================================================
23. AI SENTENCE REQUIREMENTS
==================================================

When the user selects HSK 1:

Use HSK 1 vocabulary as much as possible.

HSK 2:

Use HSK 1–2 vocabulary.

HSK 3:

Use HSK 1–3 vocabulary.

HSK 4:

Use HSK 1–4 vocabulary.

Avoid unnecessarily advanced vocabulary.

The target vocabulary word must appear naturally in the sentence.

Sentences should be natural Mandarin, not strange textbook-like AI output.

==================================================
24. SENTENCE LENGTH
==================================================

Support sentence difficulty based on level.

For example:

HSK 1:
approximately 4–8 Chinese characters

HSK 2:
approximately 5–12 Chinese characters

HSK 3:
approximately 8–18 Chinese characters

HSK 4:
approximately 10–25 Chinese characters

These are guidelines, not absolute limits.

For "1/2/3 lines" sentence practice:

Allow:

Short
Medium
Long

or:

1 sentence
2 sentences
3 sentences

Use the user's selected difficulty.

==================================================
25. AI OUTPUT FORMAT
==================================================

AI must return structured JSON.

Example:

{
  "sentence": "我每天学习中文。",
  "pinyin": "Wǒ měitiān xuéxí Zhōngwén.",
  "translation": "I study Chinese every day.",
  "target_words": ["学习"],
  "hsk_level": 2
}

Do NOT depend on parsing arbitrary AI prose.

Validate the JSON server-side.

==================================================
26. AI VALIDATION
==================================================

Before showing AI-generated content:

Check:

1. valid JSON
2. Chinese sentence exists
3. pinyin exists
4. English translation exists
5. target word exists in sentence
6. sentence isn't empty
7. sentence length is reasonable
8. vocabulary stays within allowed HSK scope
9. no obvious inappropriate/random content
10. sentence is actually Chinese

If validation fails:

Regenerate or reject.

Never blindly display an invalid AI result.

==================================================
27. AI CACHING
==================================================

Do NOT generate a new AI sentence every time.

Cache generated sentences.

Possible cache key:

target_word_id
+
hsk_level
+
difficulty
+
sentence_length

Example:

HSK 2 + 学习 + medium

Reuse valid cached sentences when possible.

This reduces:

- AI cost
- latency
- API usage

==================================================
28. AI RATE LIMITING
==================================================

All AI calls MUST go through the backend/server.

NEVER expose the AI provider API key in frontend code.

Architecture:

Frontend
   ↓
Your API
   ↓
Authentication
   ↓
Rate limiter
   ↓
Cache
   ↓
AI provider

Use the application's existing rate-limiting system if available.

If there is no rate limiter, create a simple server-side rate limit appropriate for the existing application.

Example configuration:

Free user:
limited AI sentence generations per day

Premium/user tiers:
higher limits if the application already supports plans

Do NOT hard-code assumptions about paid plans if the existing app does not have them.

Make the limit configurable.

==================================================
29. SECURITY
==================================================

Never trust:

- user_id from frontend
- HSK level from frontend
- answer correctness from frontend
- AI result from frontend

Validate server-side.

Use authenticated user identity from the existing auth system.

Prevent users from accessing another user's writing sessions.

Prevent unauthorized database writes.

Do not expose private API keys.

==================================================
30. UI/UX
==================================================

The writing screen should feel like a focused language-learning tool.

Avoid:

- excessive gradients
- excessive animations
- bouncing buttons
- unnecessary cards everywhere
- clutter
- huge decorative elements

Use:

- clean typography
- clear hierarchy
- generous spacing
- progress indicator
- focused input
- subtle feedback
- responsive layout

Follow the existing application's visual style instead of introducing a completely unrelated design.

==================================================
31. PRACTICE SETTINGS SCREEN
==================================================

Create a setup interface.

Example:

Chinese Writing Practice
汉字书写练习

HSK Level

[ HSK 1 ]
[ HSK 2 ]
[ HSK 3 ]
[ HSK 4 ]

Scope

[ Selected Level ]
[ Cumulative ]

Practice Type

[ English + Pinyin → Chinese ]
[ Pinyin → Chinese ]
[ English → Chinese ]
[ Chinese + Pinyin → Chinese ]
[ Chinese → Chinese ]
[ Sentence Writing ]

Order

[ Sequential ]
[ Random ]

Questions

[ 10 ]
[ 20 ]
[ 30 ]
[ 50 ]
[ 100 ]

Difficulty for sentence mode:

[ Short ]
[ Medium ]
[ Long ]

[ Start Practice ]

Make the UI consistent with the existing application.

==================================================
32. PRACTICE SESSION STATE
==================================================

The session should track:

- current question
- total questions
- selected HSK level
- practice mode
- question list
- start time
- current question start time
- answers
- correctness
- mistakes
- completion state

Do not lose the entire session because of minor UI state changes.

If the existing application supports persistence/resume, integrate with it.

==================================================
33. PERFORMANCE
==================================================

Do not load all 2,000 vocabulary records into the browser unnecessarily.

Prefer:

server/database filtering

Example:

SELECT vocabulary
WHERE hsk_level IN (...)

Then retrieve only what the session needs.

For random questions, use an efficient strategy appropriate to the existing database.

Avoid expensive random queries if the database is large.

==================================================
34. ACCESSIBILITY
==================================================

Support:

- keyboard navigation
- visible focus states
- readable contrast
- screen-reader-friendly labels
- buttons with meaningful labels
- mobile touch targets
- no keyboard-only inaccessible controls

Candidate buttons should be accessible.

==================================================
35. ERROR HANDLING
==================================================

Handle:

- no vocabulary available
- AI unavailable
- rate limit reached
- network failure
- database failure
- malformed AI output
- session expired
- user not authenticated

Never leave the user with a blank screen.

Show a useful error message and allow retry where appropriate.

==================================================
36. COMPONENT ARCHITECTURE
==================================================

Create reusable components rather than one giant page.

Suggested structure:

WritingPractice/
    WritingPracticeSetup
    WritingPracticeSession
    WritingQuestion
    WritingInput
    PinyinIME
    PinyinComposition
    CandidateBar
    ChineseKeyboard
    PracticeProgress
    AnswerFeedback
    WritingResult
    MistakeReview
    SentencePractice
    WritingSettings

Adapt names to the existing project's conventions.

The Pinyin IME should be independently testable.

==================================================
37. PINYIN IME DATA ARCHITECTURE
==================================================

Design the IME so dictionary data can be updated without rewriting UI code.

Possible structure:

{
  "pinyin": "wo",
  "candidates": [
    {
      "text": "我",
      "frequency": 100
    },
    {
      "text": "喔",
      "frequency": 80
    }
  ]
}

But do NOT limit the implementation to this exact schema if a better architecture fits the existing project.

Support phrase entries.

Example:

{
  "pinyin": "nihao",
  "text": "你好",
  "frequency": ...
}

Use a proper dictionary/data source if one is already present in the project or can be safely included.

Respect the licenses of any external dictionary/data source.

==================================================
38. IMPORTANT IME BEHAVIOR
==================================================

The composition should behave like:

User types:

x

→ show relevant candidates

User types:

xu

→ update candidates

User types:

xue

→ update candidates

User selects:

学

→ output 学

Then types:

xi

→ candidates

Then selects:

习

→ output 学习

The input should maintain:

composition state
committed Chinese text
candidate list

Do not mix these incorrectly.

==================================================
39. ANSWER INPUT MODES
==================================================

The user should be able to produce Chinese through:

A. Physical keyboard + Pinyin IME

B. On-screen Chinese keyboard

C. Native Chinese keyboard if available

Do not force the user to use only one method.

The app keyboard should be especially useful for users whose computer does not have Chinese input configured.

==================================================
40. PUNCTUATION
==================================================

For sentence practice support common Chinese punctuation where useful:

。

，
？
！
：

Do not make punctuation overly strict unless punctuation is specifically part of the exercise.

==================================================
41. TESTING
==================================================

Before declaring the feature complete, test:

Vocabulary:

- HSK 1
- HSK 2
- HSK 3
- HSK 4

Modes:

- English + Pinyin → Chinese
- Pinyin → Chinese
- English → Chinese
- Chinese + Pinyin → Chinese
- Chinese → Chinese
- Sentence writing

Order:

- sequential
- random

IME:

- single syllable
- multi-syllable
- phrase
- candidate selection
- number selection
- arrow navigation
- space
- backspace
- Enter
- physical keyboard
- on-screen keyboard

Results:

- 100% correct
- partially correct
- incorrect
- empty answer
- punctuation difference

AI:

- valid generation
- invalid generation
- rate limit
- cache hit
- cache miss
- AI failure

Responsive:

- desktop
- tablet
- mobile

Authentication:

- logged-in user
- logged-out user

==================================================
42. DO NOT BREAK EXISTING FEATURES
==================================================

This is critical.

After implementation:

Check all existing routes and features.

Do not:

- modify unrelated database tables unnecessarily
- replace existing UI components without reason
- break authentication
- break HSK vocabulary
- break quizzes
- break flashcards
- break existing AI tutor
- break progress tracking
- break mobile UI

If an existing component can be reused safely, reuse it.

If modification is required, make it backward compatible.

==================================================
43. DATABASE MIGRATION
==================================================

If new database tables are required:

Create proper migrations.

Do not manually modify production data.

Add appropriate:

- indexes
- foreign keys
- constraints

If the existing project uses Supabase:

Use the existing Supabase conventions.

Do not create a second database connection.

==================================================
44. API DESIGN
==================================================

Prefer clean API boundaries.

Possible endpoints:

GET
/writing/practice

POST
/writing/session

POST
/writing/attempt

POST
/writing/session/complete

POST
/writing/ai-sentence

GET
/writing/progress

GET
/writing/mistakes

POST
/writing/ime/candidates

But first inspect the existing API architecture and follow its conventions.

Do not blindly implement these exact routes if the project uses another pattern.

==================================================
45. FRONTEND STATE
==================================================

Use the existing state-management approach.

Avoid introducing Redux/Zustand/etc. if the application does not need it.

Keep:

practice state
IME state
candidate state
session state

separate where appropriate.

==================================================
46. DESIGN DETAILS
==================================================

The main practice interface should prioritize:

Question
↓
Hint
↓
Input
↓
Candidate bar
↓
Keyboard
↓
Check button

On mobile, the keyboard should remain usable without taking the entire screen.

The candidate bar should stay close to the composition input.

The answer area should clearly distinguish:

Pinyin composition

from

committed Chinese answer.

==================================================
47. LEARNING FEEDBACK
==================================================

Correct:

Show a subtle positive state.

Incorrect:

Show the correction.

Example:

Incorrect

Your answer:
学西

Correct:
学习

Pinyin:
xuéxí

Meaning:
to study

Do not immediately move away so quickly that the learner cannot understand the mistake.

Use the existing quiz/learning feedback timing if available.

==================================================
48. FUTURE EXTENSIBILITY
==================================================

Architect the system so future features can be added:

- handwriting recognition
- stroke-order practice
- character drawing
- adaptive difficulty
- spaced repetition
- weak-character practice
- HSK 5–6
- custom vocabulary lists
- imported vocabulary
- teacher-created writing exercises
- AI writing evaluation
- daily writing challenges

Do NOT build all of these now.

Only make the architecture extensible.

==================================================
49. IMPLEMENTATION PRIORITY
==================================================

Build in this order:

PHASE 1:
Inspect existing application.

PHASE 2:
Writing Practice database/session architecture.

PHASE 3:
Vocabulary writing practice.

PHASE 4:
Answer evaluation + result system.

PHASE 5:
Progress/mistake tracking.

PHASE 6:
Chinese Pinyin IME.

PHASE 7:
AI sentence generation.

PHASE 8:
AI validation + caching + rate limiting.

PHASE 9:
Responsive/mobile refinement.

PHASE 10:
Testing and bug fixing.

==================================================
50. MVP DEFINITION
==================================================

The feature is NOT complete until a user can:

1. Open Writing Practice.
2. Select HSK 1/2/3/4.
3. Select a writing mode.
4. Select sequential/random.
5. Start a session.
6. Receive a vocabulary question.
7. Type Pinyin using a physical keyboard.
8. See Chinese candidate suggestions.
9. Select Chinese candidates.
10. Submit the answer.
11. Receive correctness feedback.
12. Continue through the session.
13. See final score.
14. Review mistakes.
15. Have writing performance saved.

Then:

16. Start sentence practice.
17. Receive an AI-generated sentence appropriate to the HSK level.
18. Write the Chinese sentence.
19. Receive correctness feedback.
20. Have the sentence cached and not regenerate unnecessarily.
21. Respect AI rate limits.

==================================================
51. CODE QUALITY REQUIREMENTS
==================================================

Write production-quality code.

Use:

- TypeScript types
- reusable components
- clear naming
- proper error handling
- validation
- server-side security
- database constraints
- efficient queries
- comments only where useful

Avoid:

- giant components
- duplicated logic
- hard-coded HSK vocabulary
- hard-coded AI responses
- API keys in frontend
- fake/mock data in production paths
- TODO placeholders
- unnecessary dependencies
- unnecessary rewrites

==================================================
52. FINAL REQUIREMENT
==================================================

Do NOT stop after creating the UI.

The feature must actually work end-to-end.

That means:

UI
→ state
→ API
→ database
→ vocabulary
→ IME
→ answer evaluation
→ AI
→ caching
→ rate limiting
→ progress
→ results

must all work together.

==================================================
53. FINAL VERIFICATION
==================================================

After implementation:

1. Run the project's existing lint/type checks.
2. Run tests.
3. Build the application.
4. Fix TypeScript errors.
5. Fix runtime errors.
6. Check database migrations.
7. Check mobile layout.
8. Check keyboard interactions.
9. Check existing application routes.
10. Check authentication.
11. Check AI rate limiting.
12. Check API security.
13. Check that no existing feature was broken.

Do not claim completion if the build is failing.

==================================================
54. DEVELOPMENT RULE
==================================================

If you encounter an architectural conflict:

DO NOT randomly rewrite the project.

First understand the existing implementation and adapt the feature to it.

If something genuinely cannot be implemented safely without changing an existing system, explain the conflict and choose the smallest backward-compatible change.

The existing application is the source of truth.

Start by inspecting the repository now.
Then implement the feature incrementally.