/**
 * Generates migrations/013_seed_grade6_ai_curriculum.sql from the Class 6 AI PDF content.
 * Usage: npx tsx scripts/generate_grade6_ai_seed.ts
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

type Activity = {
  slug: string;
  code: string;
  title: string;
  theme: string;
  stars: number;
  emoji: string;
  accent: string;
  sort: number;
  minutes: number;
  problem: string;
  runIt: string;
  clues: [string, string, string];
  reveal: string;
  extend: string;
};

type Module = {
  code: string;
  title: string;
  hours: number;
  blurb: string;
  activities: Activity[];
};

const modules: Module[] = [
  {
    code: "1",
    title: "What Is AI?",
    hours: 5,
    blurb:
      "Machine intelligence vs. human intelligence, AI vs. automation, and the three ways machines learn.",
    activities: [
      {
        slug: "ai6-m1-ai-or-just-a-machine",
        code: "AI6-M1-01",
        title: "AI or Just a Machine?",
        theme: "Everyday Tech",
        stars: 1,
        emoji: "🤖",
        accent: "teal",
        sort: 1,
        minutes: 15,
        problem:
          "Four gadgets are named: a kitchen weighing scale, a UPI app that flags a suspicious payment, a ceiling fan regulator, and a phone camera that recognises faces to unlock. Which of these are AI, and which are simple automation?",
        runIt:
          'Hold up (or draw) four cards, one per gadget. Students physically move to an "AI" corner or an "Automation" corner of the room for each one, then defend their choice.',
        clues: [
          "For each gadget, ask: does it follow one instruction someone wrote in advance, or does it seem to have looked at many examples first?",
          "Look at the kitchen scale and the fan regulator together. What do the two of them have in common in how they work?",
          "Now look at the UPI fraud flag and the face-unlock camera. What would each of them have needed to see many times before, in order to work at all?",
        ],
        reveal:
          "Automation: the kitchen scale and fan regulator, both follow one fixed rule with no learning involved. AI: the UPI fraud flag and face-unlock camera, both learned a pattern from many past examples.",
        extend:
          "Ask: could the fan regulator ever become AI? What would have to change? (It would need to learn a pattern, for instance adjusting itself based on how hot the room usually gets at that time of day.)",
      },
      {
        slug: "ai6-m1-sorting-mangoes",
        code: "AI6-M1-02",
        title: "Sorting Mangoes with Meera Aunty",
        theme: "Kirana / Market",
        stars: 2,
        emoji: "🥭",
        accent: "amber",
        sort: 2,
        minutes: 15,
        problem:
          'Meera Aunty has sorted 40 mangoes into "ripe" and "raw" piles, and every mango already has a little sticker saying which pile it belongs to. Her nephew watches all 40, then picks up mango number 41, which has no sticker, and predicts which pile it belongs to. What kind of learning is this?',
        runIt:
          'Bring (or draw) 10 mango cards, 5 labelled "ripe" and 5 labelled "raw," with colour and firmness noted on each. Add one unlabelled card and have students predict its label using the pattern from the first 10.',
        clues: [
          "What's the difference between having a labelled example and not having one?",
          "Did the first 40 mangoes already have their correct answer, ripe or raw, written on them?",
          "So is the nephew guessing mango 41's label from nothing at all, or from the pattern in 40 labelled examples?",
        ],
        reveal:
          "This is supervised learning: the nephew learns from mangoes that already carry the correct label, then applies that pattern to a new, unlabelled case.",
        extend:
          "What would happen if half the stickers were wrong? Would the nephew still learn the right pattern? (This is a gentle first brush with the idea of noisy or incorrect training data.)",
      },
      {
        slug: "ai6-m1-unlabelled-spice-box",
        code: "AI6-M1-03",
        title: "The Unlabelled Spice Box",
        theme: "Kirana / Market",
        stars: 2,
        emoji: "🌶️",
        accent: "amber",
        sort: 3,
        minutes: 15,
        problem:
          'A new shop assistant is handed a box with 30 loose spice packets, no labels, all mixed together. He is told to "group the similar ones together" without being told what the groups should be called. He ends up with piles by smell and colour: reddish-orange powders in one pile, dark whole pods in another, pale seeds in a third. What kind of learning does this match?',
        runIt:
          "Give students a mixed set of 12–15 small objects (buttons, beads, pulses) with no labels and ask them to form their own groups, then explain the rule they used.",
        clues: [
          "Were the spice packets given any names or labels to begin with?",
          "So how did the assistant decide which pile a packet belonged to, if nobody told him?",
          "If there's no correct answer given in advance, and the groups are discovered rather than told, what kind of learning does that sound like?",
        ],
        reveal:
          "This is unsupervised learning: there are no labels at all, the assistant (or system) finds its own structure by comparing similarities.",
        extend:
          "Two students given the identical unlabelled box may form different groupings. Discuss: is one of them wrong, or can both groupings be valid?",
      },
      {
        slug: "ai6-m1-learning-to-fly-a-kite",
        code: "AI6-M1-04",
        title: "Learning to Fly a Kite",
        theme: "Everyday Life",
        stars: 3,
        emoji: "🪁",
        accent: "sky",
        sort: 4,
        minutes: 15,
        problem:
          "Aryan has never flown a kite before. Nobody gives him a rulebook. He tries pulling the string a little, the kite dips, he tries pulling harder, it climbs, he keeps adjusting based on what happens each time, and after twenty tries, he can keep the kite steady. Which of the three learning types does this match, and why?",
        runIt:
          'Have a small group play a simple hand-clap rhythm game where a "reward" (a point, a clap-back) is given only for a correct pattern, so the group has to adjust their rhythm attempt by attempt.',
        clues: [
          "Did anyone hand Aryan a rulebook or a set of correct examples before he started flying the kite?",
          "What happens right after each pull of the string, does something tell him whether that pull was right or wrong?",
          'Is that "something" a labelled example, or more like a consequence, the kite rising or dipping, that he adjusts to?',
        ],
        reveal:
          "This is reinforcement learning: there's no example data at all, only trial, a consequence (the kite rising or falling), and adjustment toward a goal.",
        extend:
          'What is playing the role of the "reward" in Aryan\'s kite example? What would happen if the reward (the kite staying up) never came, no matter what he tried?',
      },
      {
        slug: "ai6-m1-name-that-learning-type",
        code: "AI6-M1-05",
        title: "Name That Learning Type",
        theme: "Mixed Review",
        stars: 3,
        emoji: "🎯",
        accent: "teal",
        sort: 5,
        minutes: 20,
        problem:
          'Four short scenarios are read aloud: (a) a music app groups songs into "playlists you might like" with no one telling it what the playlists should be, (b) a doctor\'s assistant predicts a disease from thousands of past patient records that were each marked with the correct diagnosis, (c) a robot vacuum learns the fastest route around a room only after bumping into furniture many times, (d) an app sorts old family photos into folders by comparing them to a set of pictures you already tagged with names. For each, name the learning type.',
        runIt:
          "Read one scenario at a time. Students hold up one of three cards (Supervised / Unsupervised / Reinforcement) simultaneously, so answers cannot be copied from a neighbour.",
        clues: [
          "For each scenario, ask first: is there labelled example data given upfront, no labels at all, or just trial-and-error feedback?",
          "If there are no labels and no reward, but the system is grouping things by similarity, what does that sound like?",
          "If there IS a reward or consequence driving the behaviour, but no upfront correct-answer examples, what does that sound like instead?",
        ],
        reveal:
          "(a) Unsupervised, groups songs with no given labels. (b) Supervised, learns from records already labelled with the correct diagnosis. (c) Reinforcement, learns by trial, error, and consequence. (d) Supervised, learns from photos you already labelled with names.",
        extend:
          "Ask students to invent one new scenario of their own, from home or their school, for each of the three learning types.",
      },
    ],
  },
  {
    code: "2",
    title: "Basic Data Concepts",
    hours: 5,
    blurb:
      "Recognising data types, and organising raw information into something a machine, or a mentor, can actually read.",
    activities: [
      {
        slug: "ai6-m2-what-kind-of-data",
        code: "AI6-M2-01",
        title: "What Kind of Data Is This?",
        theme: "School Life",
        stars: 1,
        emoji: "📊",
        accent: "sky",
        sort: 1,
        minutes: 15,
        problem:
          "Four items are shown: the class attendance register, a voice note from the school announcement speaker, a photo of the school Republic Day parade, and a wedding invitation card. Sort each into one of four data types: text, number, image, or sound.",
        runIt:
          "Bring four real or printed examples into class and have students physically sort them under four labelled headings on a table.",
        clues: [
          "Does this item contain written words, numbers, a picture you can see, or something you can only hear?",
          "Look closely at the attendance register, could it actually hold more than one data type at once?",
          "Sound is different from image, and text is different from number, which of the four fits each remaining item best?",
        ],
        reveal:
          "Attendance register: mainly numbers (with some text). Announcement voice note: sound. Republic Day photo: image. Wedding card: text.",
        extend:
          "Can one item hold more than one data type at once? (The attendance register has both text, names, and numbers, roll numbers and present/absent counts.)",
      },
      {
        slug: "ai6-m2-organise-kirana-shelf",
        code: "AI6-M2-02",
        title: "Organise the Kirana Shelf",
        theme: "Kirana / Market",
        stars: 2,
        emoji: "🛒",
        accent: "amber",
        sort: 2,
        minutes: 20,
        problem:
          "A shopkeeper has a messy list of 20 items scribbled on paper: rice, soap, toothpaste, dal, shampoo, wheat flour, and so on, with prices written next to each in no particular order. Organise this into a clean table with clear categories (for example, Groceries, Personal Care) and columns for item name and price.",
        runIt:
          "Give groups the scrambled list on paper strips. They physically arrange the strips into a table on the floor or a large sheet before copying it into a notebook.",
        clues: [
          "Before organising anything, can you sort the 20 items into just two or three big groups?",
          'Within a group like "Personal Care," is there an order that would make the list easier to scan, like alphabetical?',
          "What information does each item need next to it to actually be useful, just a name, or a name and a price?",
        ],
        reveal:
          "A worked example table: categories Groceries and Personal Care, with item name and price columns, alphabetised within each category. Sample: Groceries — Dal (1 kg) 110, Rice (1 kg) 65, Wheat flour (1 kg) 48; Personal Care — Shampoo (small) 90, Soap 35, Toothpaste 55. (Prices simulated for teaching.)",
        extend:
          "Once organised, ask: which category has the most items? Which is more expensive on average? Notice how organising data makes new questions answerable that were invisible in the messy list.",
      },
      {
        slug: "ai6-m2-reading-monsoon-chart",
        code: "AI6-M2-03",
        title: "Reading the Monsoon Chart",
        theme: "Weather / Geography",
        stars: 3,
        emoji: "🌧️",
        accent: "sky",
        sort: 3,
        minutes: 15,
        problem:
          "A simple bar chart shows rainfall (in mm, simulated figures) for June through September in a small town: June 180, July 310, August 260, September 140. Which month had the heaviest rainfall? How much more rain fell in July than September?",
        runIt:
          "Draw the four bars on the board without numbers first. Have students estimate values purely by comparing bar heights before revealing the numbers.",
        clues: [
          "Which bar on the chart reaches the highest point?",
          "Now find July's bar and September's bar specifically, which one is taller, and by roughly how much?",
          'To find "how much more" rain fell in one month than another, what do you do with the two numbers, add them or subtract them?',
        ],
        reveal:
          "Heaviest rainfall: July (310 mm). Difference between July and September: 310 − 140 = 170 mm. (Rainfall figures here are simulated for the exercise, not real recorded data for any specific town.)",
        extend:
          "If a farmer had to pick the single best month to plant a crop that dislikes too much water but needs some rain, which month from this chart looks safest, and why?",
      },
      {
        slug: "ai6-m2-build-your-own-data-table",
        code: "AI6-M2-04",
        title: "Build Your Own Data Table",
        theme: "Classroom Activity",
        stars: 2,
        emoji: "📋",
        accent: "teal",
        sort: 4,
        minutes: 20,
        problem:
          "Each student notes down three things about five classmates: favourite subject, number of siblings, and preferred sport. This is scattered, spoken information. Turn it into a single organised table.",
        runIt:
          "Physical interview activity: students walk around, ask five classmates the three questions, and fill in a blank table template as they go.",
        clues: [
          "What three pieces of information are you collecting from each classmate?",
          "If those three pieces become your column headers, what should go in the very first column of all?",
          "Once every row is filled in, how could you find the class's most common favourite subject just by looking at the finished table?",
        ],
        reveal:
          "Guidance, not a locked answer: No single fixed answer, this activity produces real classroom data. Model the header row (Name / Subject / Siblings / Sport) before students begin, then count occurrences together as a class.",
        extend:
          "Once every student has a table, combine everyone's tables on the board into one class-wide table. What is the most common favourite subject in the whole class?",
      },
    ],
  },
  {
    code: "3",
    title: "Pattern Recognition & Decision-Making",
    hours: 5,
    blurb:
      "Spotting what repeats, then acting on it, the two-step move every AI system makes, done here entirely by hand.",
    activities: [
      {
        slug: "ai6-m3-dabbawalas-rhythm",
        code: "AI6-M3-01",
        title: "The Dabbawala's Rhythm",
        theme: "Mumbai / Logistics",
        stars: 2,
        emoji: "🍱",
        accent: "amber",
        sort: 1,
        minutes: 15,
        problem:
          "A dabbawala collects lunchboxes from five buildings in this order every single day: A, C, B, A, C, B, A, C, ? What comes next, and how did you know?",
        runIt:
          "Use physical building cards (or students standing in a line) and have the class physically continue the sequence by stepping into the next position.",
        clues: [
          "Look at the sequence so far, does anything repeat after a fixed number of steps?",
          "Count how many buildings appear before the pattern starts over. What is that number?",
          "If the cycle is A, C, B and it has just repeated up to ...A, C, what comes right after C in that cycle?",
        ],
        reveal:
          "The sequence repeats in a fixed 3-step cycle: A, C, B. After ...A, C, B, A, C, the next is B.",
        extend:
          "If one day the dabbawala had to skip building C because it was closed, what pattern would the delivery sequence show that day?",
      },
      {
        slug: "ai6-m3-library-yes-or-no",
        code: "AI6-M3-02",
        title: "Should the Library Say Yes or No?",
        theme: "School Life",
        stars: 3,
        emoji: "📚",
        accent: "teal",
        sort: 2,
        minutes: 15,
        problem:
          "A school library has a simple rule for its digital system: if a book is more than 14 days overdue AND the student has more than 2 books already borrowed, flag the account. Given three students' records (Student 1: 10 days overdue, 1 book; Student 2: 20 days overdue, 3 books; Student 3: 16 days overdue, 1 book), which accounts get flagged?",
        runIt:
          'Give each group a stack of "student record" cards with the two numbers on each, and have them physically sort cards into "Flag" and "No Flag" piles by applying the rule.',
        clues: [
          "What are the two conditions that must BOTH be true for an account to be flagged?",
          "Check Student 1 against both conditions, does either one actually hold true?",
          "Now check Student 3, they're well past 14 days overdue, but what about the second condition, the number of books?",
        ],
        reveal:
          "Only Student 2 is flagged (20 days overdue AND 3 books, both conditions true). Students 1 and 3 each fail at least one condition. This is a rule-based decision, not a learned one, useful for contrasting with AI from Module 1.",
        extend:
          "This rule was written by a person, not learned from data. How is this different from an AI system deciding the same thing after studying thousands of past overdue records?",
      },
      {
        slug: "ai6-m3-predicting-the-next-over",
        code: "AI6-M3-03",
        title: "Predicting the Next Over",
        theme: "Cricket",
        stars: 4,
        emoji: "🏏",
        accent: "sky",
        sort: 3,
        minutes: 15,
        problem:
          "In a simulated T20 match, a batter has scored 4, 6, 4, 6, 4 runs off her last five balls faced from one bowler. Based only on this pattern, predict roughly what she might score off the next ball, and explain why a real prediction would need far more data than this.",
        runIt:
          "Chart the five scores as dots on a simple number line or bar drawing, then have students mark where they think the sixth dot should sit and defend the choice.",
        clues: [
          "Look at the five scores, do they seem to alternate between two particular numbers?",
          "If that alternating pattern truly holds, what would come right after ...4, 6, 4?",
          "Now ask: is five balls really enough data to trust this prediction in a real match? What real information is missing?",
        ],
        reveal:
          "The visible pattern alternates high-low (4, 6, 4, 6, 4), so 6 is a reasonable pattern-based guess, but the real teaching point is that five balls is far too little data, real systems would want the bowler's full over-by-over history, delivery type, and field placement. (All figures simulated for the exercise.)",
        extend:
          "What other information (beyond these five balls) would a real AI system want before making this prediction? List at least three.",
      },
      {
        slug: "ai6-m3-spot-the-odd-one",
        code: "AI6-M3-04",
        title: "Spot the Odd One in the Data",
        theme: "Data Detective",
        stars: 3,
        emoji: "🔍",
        accent: "slate",
        sort: 4,
        minutes: 15,
        problem:
          "A shop's daily sales for one week (in rupees, simulated): 2,000 / 2,200 / 1,950 / 2,100 / 15,000 / 2,050 / 2,150. One number does not fit the pattern of the rest. Which one, and what might explain it in real life?",
        runIt:
          "Plot the seven values as bars on the board (heights roughly to scale), the mismatch becomes visually obvious before any calculation.",
        clues: [
          "Look at six of the seven numbers, ignoring the one that looks different, are they roughly close to each other?",
          "Which single number breaks that closeness the most?",
          "In real life, what kind of day could cause one day's sales to jump far above all the rest?",
        ],
        reveal:
          "Rs. 15,000 is the anomaly, roughly seven times the typical daily figure. Possible explanations: a festival rush day, a bulk order, or a data-entry error, the pattern alone cannot tell us which, only that it needs a closer look. (Figures simulated for the exercise.)",
        extend:
          "An AI fraud-detection system uses exactly this idea, spotting a transaction that does not match a person's usual pattern. What is one everyday example where you'd want a system to flag something unusual like this?",
      },
    ],
  },
  {
    code: "4",
    title: "Ethics & Digital Responsibility",
    hours: 5,
    blurb:
      "Privacy, fairness, and safe habits, so a student can use AI and the internet with judgement, not just enthusiasm.",
    activities: [
      {
        slug: "ai6-m4-whose-photo-is-it",
        code: "AI6-M4-01",
        title: "Whose Photo Is It, Really?",
        theme: "Digital Footprint",
        stars: 2,
        emoji: "📸",
        accent: "sky",
        sort: 1,
        minutes: 15,
        problem:
          "A student posts a photo from a school annual day function online, tagging four classmates by name, without asking them first. Is this a problem? If so, for whom?",
        runIt:
          "Role-play in pairs: one student plays the poster, one plays a tagged classmate who was not asked. Act out the conversation that should have happened before posting.",
        clues: [
          "Was anyone in the photo actually asked before it was posted and tagged with their name?",
          "Does tagging someone add information about them to the internet, even though they didn't post it themselves?",
          "If a tagged classmate later wanted that photo taken down, could they always make that happen easily and quickly?",
        ],
        reveal:
          "Discussion points to arrive at together: Consent matters even for photos taken in a shared space; tagging adds to someone else's digital footprint, not just the poster's; asking first is a small habit with a real, lasting difference.",
        extend:
          'What is a "digital footprint," and how is tagging someone else\'s name and face part of building their digital footprint, not just your own?',
      },
      {
        slug: "ai6-m4-fair-or-unfair",
        code: "AI6-M4-02",
        title: "Fair or Unfair?",
        theme: "Bias in AI",
        stars: 3,
        emoji: "⚖️",
        accent: "amber",
        sort: 2,
        minutes: 20,
        problem:
          "A school's new sports-recommendation app only ever suggests cricket to boys and dance to girls, no matter what a student actually enters as their interest. What has gone wrong here, and where would this problem most likely have come from?",
        runIt:
          "Small groups design (on paper) what training examples they would feed the app instead, to avoid this exact problem, and present their fix to the class.",
        clues: [
          "Does the app's suggestion actually change based on what a student types, or does it seem to depend on something else entirely?",
          "If this app learned from past examples, like Module 1's supervised learning, where would those past examples have originally come from?",
          "If those past examples already reflected old assumptions about who plays what sport, what would the app end up learning to repeat?",
        ],
        reveal:
          "Discussion points to arrive at together: This is a bias problem, most likely rooted in training data that reflected old assumptions (past enrolment records skewed by gender). The fix starts with better, more varied examples, not just a smarter algorithm.",
        extend:
          "Connect back to Module 1: if this app learned from supervised examples, what does that suggest about the examples it was trained on in the first place?",
      },
      {
        slug: "ai6-m4-password-power",
        code: "AI6-M4-03",
        title: "Password Power",
        theme: "Online Safety",
        stars: 1,
        emoji: "🔐",
        accent: "slate",
        sort: 3,
        minutes: 15,
        problem:
          'Compare four passwords: "123456," "ravi2015" (a birth year), "R@vi!2015#Cricket," and "correcthorsebatterystaple." Rank them from weakest to strongest and explain your ranking.',
        runIt:
          "Write all four on cards and have students physically arrange them in a line from weakest to strongest, then debate any disagreements.",
        clues: [
          "Which of the four passwords could someone guess just by knowing your name and birth year?",
          "Does adding symbols to a personal detail, like a birth year, make it truly unpredictable, or just longer and fiddlier to type?",
          'What makes "correcthorsebatterystaple" hard to guess, even though it has no symbols or numbers at all?',
        ],
        reveal:
          'Weakest to strongest, roughly: "123456" (an extremely common, guessable sequence), "ravi2015" (personal and predictable), "R@vi!2015#Cricket" (longer and mixed, but still built from guessable personal details), "correcthorsebatterystaple" (long and unpredictable, hard to guess by a pattern-matching attacker).',
        extend:
          "Why might a long, unusual phrase sometimes be just as strong as, or stronger than, a shorter password stuffed with symbols?",
      },
      {
        slug: "ai6-m4-right-to-say-no",
        code: "AI6-M4-04",
        title: "The Right to Say No",
        theme: "Privacy / DPDP",
        stars: 2,
        emoji: "🛡️",
        accent: "teal",
        sort: 4,
        minutes: 15,
        problem:
          "A free learning app asks for permission to access a student's photo gallery and contact list before letting them start a simple maths quiz. Does the app actually need this information to do its job? What should a student, or a parent, do here?",
        runIt:
          "Have students list, for three apps they actually use, what permission each one asks for versus what it actually needs to do its stated job.",
        clues: [
          "What does a simple maths quiz actually need to know about you in order to function?",
          'Does "photo gallery" or "contact list" appear anywhere in that list of real needs?',
          "India's DPDP Act says consent should be specific and informed, not a single blanket click. What does an unrelated permission request suggest about that standard?",
        ],
        reveal:
          "Discussion points to arrive at together: Consent should be tied to what a service actually needs; unrelated permission requests are a signal to pause and ask why; it is reasonable, and encouraged, to say no or check with an adult first.",
        extend:
          'India\'s DPDP Act 2023 gives individuals a right to meaningful consent, permission that is specific and informed, not just a single blanket "Accept All" click. Why does a maths-quiz app asking for contacts fail that standard?',
      },
    ],
  },
];

function sqlStr(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function difficulty(stars: number): string {
  if (stars <= 1) return "Developing";
  if (stars === 2) return "Developing";
  if (stars === 3) return "Secure";
  return "Extending";
}

function emitActivity(a: Activity): string {
  const meta = JSON.stringify({
    quest_code: a.code,
    theme: a.theme,
    difficulty: difficulty(a.stars),
    stars: a.stars,
    emoji: a.emoji,
    accent: a.accent,
    source: "AICUMEN_Class6_AI_Curriculum",
  });
  const context = JSON.stringify({ run_it: a.runIt, grade: 6 });
  const answer = JSON.stringify({
    answer_type: "short_text",
    body: { value: a.reveal },
  });

  return `
  IF NOT EXISTS (SELECT 1 FROM activities WHERE slug = ${sqlStr(a.slug)}) THEN
    INSERT INTO activities (
      chapter_id, slug, title, activity_type, source_type_label,
      sort_order, estimated_minutes, ct_skills, ai_concept, status, metadata,
      external_id, chapter_dependent, enrichment_status
    ) VALUES (
      ch_id, ${sqlStr(a.slug)}, ${sqlStr(a.title)}, 'quest', 'Class 6 AI',
      ${a.sort}, ${a.minutes}, ARRAY['ai_literacy']::text[], NULL, 'published',
      ${sqlStr(meta)}::jsonb,
      ${sqlStr(a.code)}, TRUE, 'enriched'
    ) RETURNING id INTO act_id;

    INSERT INTO questions (activity_id, role, sort_order, stem, hint, answer_spec, context, teacher_notes)
    VALUES (
      act_id, 'stem', 0, ${sqlStr(a.problem)}, NULL,
      ${sqlStr(answer)}::jsonb,
      ${sqlStr(context)}::jsonb,
      ${sqlStr(`RUN IT: ${a.runIt}`)}
    ) RETURNING id INTO stem_id;

    INSERT INTO questions (activity_id, role, sort_order, label, stem, teacher_notes)
    VALUES
      (act_id, 'coach_step', 1, 'Clue 1', ${sqlStr(a.clues[0])}, 'Reveal one clue per student attempt.'),
      (act_id, 'coach_step', 2, 'Clue 2', ${sqlStr(a.clues[1])}, 'Reveal one clue per student attempt.'),
      (act_id, 'coach_step', 3, 'Clue 3', ${sqlStr(a.clues[2])}, 'Reveal one clue per student attempt.');

    INSERT INTO questions (activity_id, parent_question_id, role, sort_order, stem, answer_spec)
    VALUES (
      act_id, stem_id, 'extend', 4, ${sqlStr(a.extend)},
      '{"answer_type":"open_rubric","body":{"rubric":["Reasoned discussion; answers may vary."]}}'::jsonb
    );
  END IF;
`;
}

let sql = `-- Seed Class 6 AI Literacy curriculum (Part 2 PDF) under subjects.slug = 'ai'.
-- Idempotent. Run after 012_ai_program_subject.sql.
-- Source: docs/AICUMEN_Class6_AI_Curriculum 2.pdf

BEGIN;

INSERT INTO content_ingest_batches (source_label, source_file, source_kind, row_count, notes)
VALUES (
  'class6_ai_curriculum_v1',
  'docs/AICUMEN_Class6_AI_Curriculum 2.pdf',
  'manual',
  17,
  'Generated by scripts/generate_grade6_ai_seed.ts — full PROBLEM / Socratic ladder / EXTEND from PDF'
)
ON CONFLICT (source_label) DO UPDATE SET
  row_count = EXCLUDED.row_count,
  ingested_at = NOW();

DO $$
DECLARE
  subj_id INTEGER;
  ch_id INTEGER;
  act_id INTEGER;
  stem_id INTEGER;
BEGIN
  SELECT id INTO subj_id FROM subjects WHERE slug = 'ai';
  IF subj_id IS NULL THEN
    RAISE EXCEPTION 'AI subject not found — run migration 012_ai_program_subject.sql first';
  END IF;
`;

for (const m of modules) {
  const meta = JSON.stringify({
    hours: m.hours,
    curriculum_pack: "grade6_ai_literacy",
    blurb: m.blurb,
  });
  sql += `
  -- Module ${m.code}: ${m.title}
  SELECT c.id INTO ch_id
    FROM chapters c
   WHERE c.subject_id = subj_id AND c.chapter_code = ${sqlStr(m.code)};
  IF ch_id IS NULL THEN
    INSERT INTO chapters (subject_id, grade, chapter_code, title, anchor_curriculum, metadata)
    VALUES (
      subj_id, 6, ${sqlStr(m.code)}, ${sqlStr(m.title)},
      'CBSE Class 6 AI Literacy',
      ${sqlStr(meta)}::jsonb
    ) RETURNING id INTO ch_id;
  END IF;
`;
  for (const a of m.activities) {
    sql += emitActivity(a);
  }
}

sql += `
END $$;

COMMIT;
`;

const out = join(__dirname, "..", "migrations", "013_seed_grade6_ai_curriculum.sql");
writeFileSync(out, sql, "utf8");
console.log(`Wrote ${out}`);
console.log(
  `Modules: ${modules.length}, activities: ${modules.reduce((n, m) => n + m.activities.length, 0)}`,
);
