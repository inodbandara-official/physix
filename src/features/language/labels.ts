import type { AssessmentKind, ContentLanguage } from '@/types/database';

/**
 * The interface strings that appear alongside translated content, so a
 * Sinhala reader is not shown a Sinhala question wrapped in English
 * furniture.
 *
 * This is deliberately not a full i18n system. The teacher's side stays in
 * English — it is used by one person who chose it — and only the student
 * surfaces that carry translated content are localised.
 *
 * `{name}` placeholders are filled by `tf()`.
 */
const STRINGS = {
  syllabus: { en: 'Syllabus', si: 'විෂය නිර්දේශය' },
  syllabusIntro: {
    en: 'Everything covered in this Physics course.',
    si: 'මෙම භෞතික විද්‍යා පාඨමාලාවේ ආවරණය වන සියල්ල.',
  },
  syllabusEmpty: {
    en: 'Syllabus not published yet',
    si: 'විෂය නිර්දේශය තවම ප්‍රකාශයට පත් කර නැත',
  },
  language: { en: 'Language', si: 'භාෂාව' },
  showingEnglish: {
    en: 'Shown in English — no Sinhala translation yet.',
    si: 'ඉංග්‍රීසි බසින් දැක්වේ — තවම සිංහල පරිවර්තනයක් නැත.',
  },
  dashboard: { en: 'Dashboard', si: 'උපකරණ පුවරුව' },
  profile: { en: 'Profile', si: 'පැතිකඩ' },

  // --- Assessment list and instructions ---------------------------------
  assessments: { en: 'Assessments', si: 'පරීක්ෂණ' },
  assessmentsIntro: {
    en: 'Quizzes and tests your teacher has set for you.',
    si: 'ඔබේ ගුරුවරයා ඔබට ලබා දී ඇති ප්‍රශ්නාවලි සහ පරීක්ෂණ.',
  },
  availableNow: { en: 'Available now', si: 'දැන් කළ හැකි' },
  upcoming: { en: 'Upcoming', si: 'ඉදිරියට එන' },
  finished: { en: 'Finished', si: 'අවසන් වූ' },
  nothingAssigned: { en: 'Nothing assigned yet', si: 'තවම කිසිවක් ලබා දී නැත' },
  nothingAssignedHint: {
    en: 'When your teacher sets a quiz or test, it appears here with its deadline.',
    si: 'ඔබේ ගුරුවරයා ප්‍රශ්නාවලියක් හෝ පරීක්ෂණයක් ලබා දුන් විට, එහි අවසන් දිනය සමඟ මෙහි දිස්වේ.',
  },
  start: { en: 'Start', si: 'ආරම්භ කරන්න' },
  startNow: { en: 'Start now', si: 'දැන් ආරම්භ කරන්න' },
  startAgain: { en: 'Start another attempt', si: 'නැවත උත්සාහ කරන්න' },
  resume: { en: 'Continue', si: 'දිගටම කරන්න' },
  open: { en: 'Open', si: 'විවෘත කරන්න' },
  viewResult: { en: 'View result', si: 'ප්‍රතිඵලය බලන්න' },
  opens: { en: 'Opens', si: 'විවෘත වන්නේ' },
  closes: { en: 'Closes', si: 'වැසෙන්නේ' },
  closed: { en: 'Closed', si: 'වසා ඇත' },
  notOpenYet: { en: 'Not open yet', si: 'තවම විවෘත නැත' },
  noDeadline: { en: 'No closing date', si: 'අවසන් දිනයක් නැත' },
  timeLimit: { en: 'Time limit', si: 'කාල සීමාව' },
  noTimeLimit: { en: 'No time limit', si: 'කාල සීමාවක් නැත' },
  minutes: { en: '{n} min', si: 'මිනිත්තු {n}' },
  questions: { en: 'Questions', si: 'ප්‍රශ්න' },
  attempts: { en: 'Attempts', si: 'උත්සාහයන්' },
  attemptsLeft: { en: '{n} left', si: '{n}ක් ඉතිරියි' },
  unlimited: { en: 'Unlimited', si: 'අසීමිත' },
  noAttemptsLeft: { en: 'No attempts left', si: 'උත්සාහයන් ඉතිරි නැත' },
  bestScore: { en: 'Best score', si: 'හොඳම ලකුණු' },
  beforeYouStart: { en: 'Before you start', si: 'ආරම්භ කිරීමට පෙර' },
  ruleTimer: {
    en: 'The timer starts when you press Start and keeps running even if you leave the page.',
    si: 'ඔබ ආරම්භ කරන්න එබූ විට කාලය ගණන් කිරීම ආරම්භ වන අතර, ඔබ පිටුවෙන් ඉවත් වුවද එය දිගටම ගණන් වේ.',
  },
  ruleAutosave: {
    en: 'Your answers save automatically as you go, even if your connection drops for a moment.',
    si: 'සම්බන්ධතාවය මොහොතකට නැති වුවද, ඔබේ පිළිතුරු ස්වයංක්‍රීයව සුරැකේ.',
  },
  ruleTimeUp: {
    en: 'When time runs out, the answers you have given are submitted for you.',
    si: 'කාලය අවසන් වූ විට, ඔබ දී ඇති පිළිතුරු ස්වයංක්‍රීයව ඉදිරිපත් වේ.',
  },
  ruleNegative: {
    en: 'Wrong multiple-choice and true/false answers lose marks. A blank answer loses nothing.',
    si: 'වැරදි බහුවරණ සහ සත්‍ය/අසත්‍ය පිළිතුරු සඳහා ලකුණු අඩු වේ. පිළිතුරු නොදුන් ප්‍රශ්නවලට ලකුණු අඩු නොවේ.',
  },
  yourAttempts: { en: 'Your attempts', si: 'ඔබේ උත්සාහයන්' },
  attemptN: { en: 'Attempt {n}', si: 'උත්සාහය {n}' },
  inProgress: { en: 'In progress', si: 'සිදු වෙමින් පවතී' },
  awaitingMarking: { en: 'Awaiting marking', si: 'ලකුණු කිරීමට ඇත' },
  marked: { en: 'Marked', si: 'ලකුණු කර ඇත' },
  resultsLater: { en: 'Results later', si: 'ප්‍රතිඵල පසුව' },

  // --- Sitting an attempt ------------------------------------------------
  questionOf: { en: 'Question {n} of {total}', si: 'ප්‍රශ්නය {n} / {total}' },
  questionN: { en: 'Question {n}', si: 'ප්‍රශ්නය {n}' },
  timeRemaining: { en: 'Time remaining', si: 'ඉතිරි කාලය' },
  previous: { en: 'Previous', si: 'පෙර' },
  next: { en: 'Next', si: 'ඊළඟ' },
  flag: { en: 'Flag for review', si: 'නැවත බැලීමට සලකුණු කරන්න' },
  unflag: { en: 'Remove flag', si: 'සලකුණ ඉවත් කරන්න' },
  flagged: { en: 'Flagged', si: 'සලකුණු කළ' },
  answered: { en: 'Answered', si: 'පිළිතුරු දී ඇත' },
  notAnswered: { en: 'Not answered', si: 'පිළිතුරු දී නැත' },
  notVisited: { en: 'Not visited', si: 'නොබැලූ' },
  submit: { en: 'Submit', si: 'ඉදිරිපත් කරන්න' },
  submitting: { en: 'Submitting…', si: 'ඉදිරිපත් කරමින්…' },
  submitTitle: { en: 'Submit your answers?', si: 'ඔබේ පිළිතුරු ඉදිරිපත් කරන්නද?' },
  submitBody: {
    en: 'You have answered {answered} of {total} questions. You cannot change your answers after you submit.',
    si: 'ඔබ ප්‍රශ්න {total}න් {answered}කට පිළිතුරු දී ඇත. ඉදිරිපත් කළ පසු පිළිතුරු වෙනස් කළ නොහැක.',
  },
  submitFlagged: {
    en: '{n} still flagged for review.',
    si: 'තවමත් {n}ක් නැවත බැලීමට සලකුණු කර ඇත.',
  },
  keepWorking: { en: 'Keep working', si: 'දිගටම කරන්න' },
  saving: { en: 'Saving…', si: 'සුරකිමින්…' },
  saved: { en: 'All answers saved', si: 'සියලු පිළිතුරු සුරැකිණි' },
  offline: {
    en: 'Offline — answers kept on this device',
    si: 'සම්බන්ධතාවය නැත — පිළිතුරු මෙම උපාංගයේ ඇත',
  },
  retrying: { en: 'Not saved yet — retrying', si: 'තවම සුරැකී නැත — නැවත උත්සාහ කරමින්' },
  timeUp: { en: 'Time is up. Submitting your answers…', si: 'කාලය අවසන්. ඔබේ පිළිතුරු ඉදිරිපත් කරමින්…' },
  fiveMinutesLeft: { en: '5 minutes left', si: 'මිනිත්තු 5ක් ඉතිරියි' },
  oneMinuteLeft: { en: '1 minute left', si: 'මිනිත්තු 1ක් ඉතිරියි' },
  yourAnswer: { en: 'Your answer', si: 'ඔබේ පිළිතුර' },
  numericHint: {
    en: 'Write the value and its unit, e.g. 9.8 m s^-2',
    si: 'අගය සහ ඒකකය ලියන්න, උදා: 9.8 m s^-2',
  },
  shortHint: { en: 'Type a short answer', si: 'කෙටි පිළිතුරක් ලියන්න' },
  essayHint: { en: 'Write your answer here', si: 'ඔබේ පිළිතුර මෙහි ලියන්න' },
  trueLabel: { en: 'True', si: 'සත්‍ය' },
  falseLabel: { en: 'False', si: 'අසත්‍ය' },
  selectAll: { en: 'Select all that apply.', si: 'අදාළ සියල්ල තෝරන්න.' },
  clearAnswer: { en: 'Clear answer', si: 'පිළිතුර මකන්න' },
  aboutWords: { en: 'About {n} words', si: 'වචන {n}ක් පමණ' },
  wordCount: { en: '{n} words', si: 'වචන {n}' },
  marksN: { en: '{n} marks', si: 'ලකුණු {n}' },
  oneMark: { en: '1 mark', si: 'ලකුණු 1' },
  leave: { en: 'Leave', si: 'පිටවන්න' },
  leaveTitle: { en: 'Leave this attempt?', si: 'මෙම උත්සාහයෙන් පිටවන්නද?' },
  leaveBody: {
    en: 'Your answers are saved, and you can come back to continue. The timer keeps running.',
    si: 'ඔබේ පිළිතුරු සුරැකී ඇති අතර, නැවත පැමිණ දිගටම කළ හැක. කාලය දිගටම ගණන් වේ.',
  },
  stay: { en: 'Stay', si: 'රැඳී සිටින්න' },
  questionMap: { en: 'Question map', si: 'ප්‍රශ්න සිතියම' },

  // --- Results and review -----------------------------------------------
  result: { en: 'Result', si: 'ප්‍රතිඵලය' },
  score: { en: 'Score', si: 'ලකුණු' },
  passed: { en: 'Passed', si: 'සමත්' },
  belowPass: { en: 'Below the pass mark', si: 'සමත් ලකුණට වඩා අඩුයි' },
  passMark: { en: 'Pass mark {n}%', si: 'සමත් ලකුණ {n}%' },
  stillMarking: {
    en: 'Your teacher is still marking {n} of your answers, so this score may go up.',
    si: 'ඔබේ ගුරුවරයා තවමත් ඔබේ පිළිතුරු {n}ක් ලකුණු කරමින් සිටින නිසා, මෙම ලකුණු වැඩි විය හැක.',
  },
  heldUntilClose: {
    en: 'Your answers are in. Results appear here when the assessment closes.',
    si: 'ඔබේ පිළිතුරු ලැබී ඇත. පරීක්ෂණය අවසන් වූ පසු ප්‍රතිඵල මෙහි දිස්වේ.',
  },
  heldByTeacher: {
    en: 'Your answers are in. Your teacher will release the results.',
    si: 'ඔබේ පිළිතුරු ලැබී ඇත. ඔබේ ගුරුවරයා ප්‍රතිඵල නිකුත් කරනු ඇත.',
  },
  review: { en: 'Review your answers', si: 'ඔබේ පිළිතුරු සමාලෝචනය' },
  reviewOff: {
    en: 'Your teacher has not turned on question-by-question review for this assessment.',
    si: 'මෙම පරීක්ෂණය සඳහා ප්‍රශ්නයෙන් ප්‍රශ්නය සමාලෝචනය ඔබේ ගුරුවරයා සක්‍රීය කර නැත.',
  },
  correct: { en: 'Correct', si: 'නිවැරදියි' },
  incorrect: { en: 'Incorrect', si: 'වැරදියි' },
  partlyCorrect: { en: 'Partly correct', si: 'අර්ධ වශයෙන් නිවැරදියි' },
  waitingForTeacher: { en: 'Waiting for your teacher', si: 'ගුරුවරයා ලකුණු කිරීමට ඇත' },
  correctAnswer: { en: 'Correct answer', si: 'නිවැරදි පිළිතුර' },
  acceptedAnswer: { en: 'Accepted answer', si: 'පිළිගත් පිළිතුර' },
  explanation: { en: 'Explanation', si: 'පැහැදිලි කිරීම' },
  solution: { en: 'Worked solution', si: 'විසඳුම' },
  hint: { en: 'Hint', si: 'ඉඟිය' },
  commonMistake: { en: 'Common mistake', si: 'සුලබ වැරැද්ද' },
  teacherComment: { en: 'From your teacher', si: 'ඔබේ ගුරුවරයාගෙන්' },
  backToAssessments: { en: 'Back to assessments', si: 'පරීක්ෂණ වෙත ආපසු' },
  submitted: { en: 'Submitted', si: 'ඉදිරිපත් කළේ' },
  timeTaken: { en: 'Time taken', si: 'ගත වූ කාලය' },

  // --- Dashboard ---------------------------------------------------------
  assignedWork: { en: 'Assigned work', si: 'පැවරූ වැඩ' },
  assignedWorkIntro: {
    en: 'Quizzes and tests your teacher has set.',
    si: 'ඔබේ ගුරුවරයා ලබා දී ඇති ප්‍රශ්නාවලි සහ පරීක්ෂණ.',
  },
  averageScore: { en: 'Average score', si: 'සාමාන්‍ය ලකුණු' },
  completed: { en: 'Completed', si: 'සම්පූර්ණ කළ' },
  seeAll: { en: 'See all', si: 'සියල්ල බලන්න' },

  // --- Navigation (phone tab bar) ------------------------------------------
  navHome: { en: 'Home', si: 'මුල් පිටුව' },
  navTests: { en: 'Tests', si: 'පරීක්ෂණ' },
  navPapers: { en: 'Papers', si: 'ප්‍රශ්න පත්‍ර' },
  navProgress: { en: 'Progress', si: 'ප්‍රගතිය' },
  navRank: { en: 'Rank', si: 'ස්ථානය' },

  // --- Past papers -------------------------------------------------------
  pastPapers: { en: 'Past papers', si: 'පසුගිය ප්‍රශ්න පත්‍ර' },
  pastPapersIntro: {
    en: 'Practise real A/L papers — a whole paper, one section, or a topic across the years.',
    si: 'සැබෑ උසස් පෙළ ප්‍රශ්න පත්‍ර පුහුණු වන්න — සම්පූර්ණ පත්‍රයක්, එක් කොටසක්, හෝ වසර කිහිපයක එක් මාතෘකාවක්.',
  },
  practiceUntimed: {
    en: 'Practice is untimed and marked straight away, with worked solutions.',
    si: 'පුහුණුවට කාල සීමාවක් නැති අතර, විසඳුම් සමඟ වහාම ලකුණු කෙරේ.',
  },
  practiseWhole: { en: 'Practise the whole paper', si: 'සම්පූර්ණ පත්‍රය පුහුණු වන්න' },
  sectionN: { en: 'Section {s}', si: 'කොටස {s}' },
  practiseByTopic: { en: 'Practise by topic and year', si: 'මාතෘකාව සහ වර්ෂය අනුව පුහුණු වන්න' },
  topic: { en: 'Topic', si: 'මාතෘකාව' },
  allTopics: { en: 'All topics', si: 'සියලු මාතෘකා' },
  years: { en: 'Years', si: 'වර්ෂ' },
  allYears: { en: 'All years', si: 'සියලු වර්ෂ' },
  howMany: { en: 'Questions', si: 'ප්‍රශ්න ගණන' },
  startPractice: { en: 'Start practice', si: 'පුහුණුව ආරම්භ කරන්න' },
  questionsCount: { en: '{n} questions', si: 'ප්‍රශ්න {n}' },
  noPapers: { en: 'No past papers yet', si: 'තවම පසුගිය ප්‍රශ්න පත්‍ර නැත' },
  noPapersHint: {
    en: 'When your teacher adds past papers, you can practise them here.',
    si: 'ඔබේ ගුරුවරයා පසුගිය ප්‍රශ්න පත්‍ර එකතු කළ විට, ඒවා මෙහි පුහුණු විය හැක.',
  },
  recentPractice: { en: 'Your recent practice', si: 'ඔබේ මෑත පුහුණුව' },
  previousHandedIn: {
    en: 'Your previous practice was handed in and marked.',
    si: 'ඔබේ පෙර පුහුණුව ඉදිරිපත් කර ලකුණු කරන ලදී.',
  },
  topicPractice: { en: 'Topic practice', si: 'මාතෘකා පුහුණුව' },

  // --- Progress ------------------------------------------------------------
  progress: { en: 'Progress', si: 'ප්‍රගතිය' },
  progressIntro: {
    en: 'How you are doing, topic by topic, and how that is changing.',
    si: 'මාතෘකාවෙන් මාතෘකාවට ඔබ කරන ආකාරය, සහ එය වෙනස් වන ආකාරය.',
  },
  overallAccuracy: { en: 'Overall accuracy', si: 'සමස්ත නිරවද්‍යතාව' },
  sinceFirstMonth: { en: 'Change since your first month', si: 'පළමු මාසයේ සිට වෙනස' },
  points: { en: '{n} points', si: 'ලකුණු {n}' },
  byUnit: { en: 'By unit', si: 'ඒකක අනුව' },
  needsAttention: { en: 'Needs attention', si: 'අවධානය අවශ්‍යයි' },
  needsAttentionNone: {
    en: 'Nothing stands out yet. A topic appears here once you have answered at least 5 questions in it and are scoring under 60%.',
    si: 'තවම කිසිවක් කැපී පෙනෙන්නේ නැත. මාතෘකාවක ප්‍රශ්න අවම වශයෙන් 5කට පිළිතුරු දී 60%ට අඩු ලකුණු ලැබුවහොත් එය මෙහි දිස්වේ.',
  },
  basedOn: { en: 'Based on {n} questions', si: 'ප්‍රශ්න {n}ක් මත' },
  byDifficulty: { en: 'By difficulty', si: 'දුෂ්කරතාව අනුව' },
  byKind: { en: 'By kind of question', si: 'ප්‍රශ්න වර්ගය අනුව' },
  kindNumerical: { en: 'Numerical', si: 'සංඛ්‍යාත්මක' },
  kindConceptual: { en: 'Conceptual', si: 'සංකල්පීය' },
  kindWritten: { en: 'Written', si: 'ලිඛිත' },
  levelVeryEasy: { en: 'Very easy', si: 'ඉතා පහසු' },
  levelEasy: { en: 'Easy', si: 'පහසු' },
  levelMedium: { en: 'Medium', si: 'මධ්‍යම' },
  levelHard: { en: 'Hard', si: 'අසීරු' },
  levelVeryHard: { en: 'Very hard', si: 'ඉතා අසීරු' },
  overTime: { en: 'Month by month', si: 'මාසයෙන් මාසයට' },
  monthlyAverage: { en: 'Average score', si: 'සාමාන්‍ය ලකුණු' },
  needTwoMonths: {
    en: 'A chart appears once you have results in two different months.',
    si: 'වෙනස් මාස දෙකක ප්‍රතිඵල ලැබුණු පසු ප්‍රස්ථාරයක් දිස්වේ.',
  },
  personalBests: { en: 'Personal bests', si: 'පුද්ගලික වාර්තා' },
  highestScore: { en: 'Highest score', si: 'ඉහළම ලකුණු' },
  questionsAnswered: { en: 'Questions answered', si: 'පිළිතුරු දුන් ප්‍රශ්න' },
  fullyCorrect: { en: 'Fully correct', si: 'සම්පූර්ණයෙන් නිවැරදි' },
  longestStreak: { en: 'Longest streak', si: 'දිගම අඛණ්ඩ දින' },
  daysN: { en: '{n} days', si: 'දින {n}' },
  noResultsYet: { en: 'No results yet', si: 'තවම ප්‍රතිඵල නැත' },
  noResultsHint: {
    en: 'Finish a test or a past paper and your progress appears here.',
    si: 'පරීක්ෂණයක් හෝ පසුගිය ප්‍රශ්න පත්‍රයක් අවසන් කළ පසු ඔබේ ප්‍රගතිය මෙහි දිස්වේ.',
  },
  recentResults: { en: 'Recent results', si: 'මෑත ප්‍රතිඵල' },

  // --- Ranking -------------------------------------------------------------
  ranking: { en: 'Ranking', si: 'ශ්‍රේණිගත කිරීම' },
  rankingIntro: { en: 'Where you stand in your class.', si: 'ඔබේ පන්තියේ ඔබ සිටින තැන.' },
  yourPosition: { en: 'Your position', si: 'ඔබේ ස්ථානය' },
  ofN: { en: 'of {n}', si: '{n}න්' },
  behindNext: {
    en: 'You are {gap} points behind #{rank}.',
    si: 'ඔබ #{rank} ස්ථානයට වඩා ලකුණු {gap}කින් පසුපසින් සිටී.',
  },
  topOfClass: { en: 'You are at the top of your class.', si: 'ඔබ පන්තියේ ඉහළින්ම සිටී.' },
  notRankedYet: { en: 'Not ranked yet', si: 'තවම ශ්‍රේණිගත කර නැත' },
  notRankedHint: {
    en: 'You appear once a test that counts has its results released.',
    si: 'ගණන් ගන්නා පරීක්ෂණයක ප්‍රතිඵල නිකුත් වූ පසු ඔබ මෙහි දිස්වේ.',
  },
  you: { en: 'You', si: 'ඔබ' },
  classmate: { en: 'Classmate', si: 'පන්තියේ සිසුවෙක්' },
  rankPrivate: {
    en: 'Your teacher shows each student only their own position.',
    si: 'ඔබේ ගුරුවරයා එක් එක් සිසුවාට තමන්ගේ ස්ථානය පමණක් පෙන්වයි.',
  },
  howWorkedOut: { en: 'How this is worked out', si: 'මෙය ගණනය කරන ආකාරය' },
  rank: { en: 'Rank', si: 'ස්ථානය' },
  noClassYet: {
    en: 'You are not in a class yet, so there is no ranking to show.',
    si: 'ඔබ තවම පන්තියකට ඇතුළත් කර නැති නිසා, පෙන්වීමට ශ්‍රේණිගත කිරීමක් නැත.',
  },
  basisAverage: {
    en: 'Average of your best percentage in each test that counts.',
    si: 'ගණන් ගන්නා එක් එක් පරීක්ෂණයේ ඔබේ හොඳම ප්‍රතිශතයේ සාමාන්‍යය.',
  },
  basisTotal: { en: 'Total marks across the tests that count.', si: 'ගණන් ගන්නා පරීක්ෂණවල මුළු ලකුණු.' },
  basisWeighted: {
    en: 'Average for each type of test, combined using your teacher’s weights.',
    si: 'එක් එක් පරීක්ෂණ වර්ගයේ සාමාන්‍යය, ඔබේ ගුරුවරයාගේ බර අනුව එකතු කර ඇත.',
  },
  basisRecent: { en: 'Average of the {n} most recent tests.', si: 'මෑත පරීක්ෂණ {n}හි සාමාන්‍යය.' },
  missedZero: {
    en: 'A closed test you did not sit counts as 0%.',
    si: 'ඔබ සහභාගී නොවූ, අවසන් වූ පරීක්ෂණයක් 0% ලෙස ගණන් ගැනේ.',
  },
  missedLeftOut: { en: 'Tests you did not sit are left out.', si: 'ඔබ සහභාගී නොවූ පරීක්ෂණ ගණන් නොගනී.' },
} satisfies Record<string, Record<ContentLanguage, string>>;

export type LabelKey = keyof typeof STRINGS;

export function t(key: LabelKey, language: ContentLanguage): string {
  return STRINGS[key][language];
}

/** `t()` with `{placeholders}` filled in. */
export function tf(key: LabelKey, language: ContentLanguage, values: Record<string, string | number>): string {
  return STRINGS[key][language].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function marksLabel(marks: number, language: ContentLanguage): string {
  return marks === 1 ? t('oneMark', language) : tf('marksN', language, { n: marks });
}

const KIND_LABELS_SI: Record<AssessmentKind, string> = {
  practice: 'පුහුණු ප්‍රශ්නාවලිය',
  class_test: 'පන්ති පරීක්ෂණය',
  unit_test: 'ඒකක පරීක්ෂණය',
  term_test: 'වාර පරීක්ෂණය',
  mock_exam: 'ආදර්ශ විභාගය',
  revision: 'පුනරීක්ෂණ පරීක්ෂණය',
  custom: 'පරීක්ෂණය',
};

const KIND_LABELS_EN: Record<AssessmentKind, string> = {
  practice: 'Practice quiz',
  class_test: 'Class test',
  unit_test: 'Unit test',
  term_test: 'Term test',
  mock_exam: 'Mock exam',
  revision: 'Revision test',
  custom: 'Assessment',
};

export function kindLabel(kind: AssessmentKind, language: ContentLanguage): string {
  return language === 'si' ? KIND_LABELS_SI[kind] : KIND_LABELS_EN[kind];
}
