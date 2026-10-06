import { useEffect, useMemo, useState } from "react";

type Screen =
  | "welcome"
  | "processing"
  | "understanding"
  | "questions"
  | "refined"
  | "results"
  | "success";

type AnswerMap = Record<number, string>;

type QuestionKind = "date" | "location" | "people" | "visual";

type ParsedMemory = {
  clues: string[];
  uncertain: string[];
  location?: string;
  setting?: string;
  hasDate: boolean;
  hasEvent: boolean;
  hasPeople: boolean;
  hasVisualContext: boolean;
  nextQuestion: QuestionKind;
};

type Question = {
  kind: QuestionKind;
  prompt: string;
  helper: string;
  options: string[];
  clue: (answer: string) => string | null;
};

const candidates = [
  {
    place: "Goa · 2024",
    detail: "Café with friends",
    time: "Evening",
    match: "Strong match",
    style: "coast",
    image: "https://images.unsplash.com/photo-1753351057311-8fd3c46bc4e2?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "Friends sharing pizza and conversation at a restaurant",
  },
  {
    place: "Goa · 2024",
    detail: "Outdoor café",
    time: "Afternoon",
    match: "Strong match",
    style: "terrace",
    image: "https://images.unsplash.com/photo-1785265259335-9db79c2378c4?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "Friends enjoying drinks at an outdoor café",
  },
  {
    place: "Goa · 2024",
    detail: "Café by the water",
    time: "Morning",
    match: "Possible match",
    style: "palms",
    image: "https://images.unsplash.com/photo-1790418482510-feeea9bea498?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "Friends having tea at a table beside the water",
  },
  {
    place: "Goa · 2023",
    detail: "Beach area",
    time: "Golden hour",
    match: "Possible match",
    style: "sunset",
    image: "https://images.unsplash.com/photo-1646748019039-e908f7e41282?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "A tropical beach with palm trees and a boat",
  },
  {
    place: "Goa · 2024",
    detail: "Café table",
    time: "Late afternoon",
    match: "Another possibility",
    style: "town",
    image: "https://images.unsplash.com/photo-1701440236018-88a24c586271?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "A café table with a drink and flowers",
  },
  {
    place: "Goa · 2024",
    detail: "Waterfront café",
    time: "Afternoon",
    match: "Another possibility",
    style: "road",
    image: "https://images.unsplash.com/photo-1790418482472-b00b4e106bfb?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=900&h=620",
    alt: "Friends at a table overlooking the sea",
  },
];

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8c.5 4.8 3.2 7.5 8 8-4.8.5-7.5 3.2-8 8-.5-4.8-3.2-7.5-8-8 4.8-.5 7.5-3.2 8-8Z" />
      <path d="M19.2 16.6c.2 1.9 1.3 3 3.2 3.2-1.9.2-3 1.3-3.2 3.2-.2-1.9-1.3-3-3.2-3.2 1.9-.2 3-1.3 3.2-3.2Z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m7.5 4.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m5 12.5 4.3 4.3L19 7" />
    </svg>
  );
}

function Brand() {
  return (
    <button className="brand" onClick={() => window.location.reload()} aria-label="Memory Guide home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>Memory Guide</span>
    </button>
  );
}

function ClueChip({ children, fresh = false }: { children: React.ReactNode; fresh?: boolean }) {
  return (
    <span className={`clue-chip ${fresh ? "fresh" : ""}`}>
      <CheckIcon />
      {children}
    </span>
  );
}

function AppShell({ children, quiet = false }: { children: React.ReactNode; quiet?: boolean }) {
  return (
    <div className="app">
      <header className="topbar">
        <Brand />
        {!quiet && <span className="private-note">Your memory stays on this device</span>}
      </header>
      <main>{children}</main>
      <footer>
        <span>Memory Guide</span>
        <span>Built to help you remember, not search harder.</span>
      </footer>
    </div>
  );
}

function PhotoPlaceholder({ variant, src, alt }: { variant: string; src: string; alt: string }) {
  return (
    <div className={`photo-placeholder ${variant}`}>
      <img src={src} alt={alt} loading="lazy" />
      <span className="photo-glow" />
    </div>
  );
}

function parseMemory(memory: string): ParsedMemory {
  const value = memory.toLowerCase();
  const currentYear = new Date().getFullYear();
  const hasTerm = (term: string) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(value);
  };
  const labelsFor = (rules: { terms: string[]; label: string }[]) =>
    rules.filter((rule) => rule.terms.some(hasTerm)).map((rule) => rule.label);

  const festivalRules = [
    { terms: ["diwali", "deepavali"], label: "Diwali" },
    { terms: ["holi"], label: "Holi" },
    { terms: ["eid"], label: "Eid" },
    { terms: ["christmas", "xmas"], label: "Christmas" },
    { terms: ["navratri"], label: "Navratri" },
    { terms: ["durga puja"], label: "Durga Puja" },
    { terms: ["ganesh chaturthi"], label: "Ganesh Chaturthi" },
  ];
  const eventRules = [
    { terms: ["birthday", "bday"], label: "Birthday" },
    { terms: ["wedding", "marriage"], label: "Wedding" },
    { terms: ["graduation", "convocation"], label: "Graduation" },
    { terms: ["anniversary"], label: "Anniversary" },
    { terms: ["party"], label: "Party" },
  ];
  const locationRules = [
    { terms: ["goa"], label: "Goa" },
    { terms: ["delhi", "new delhi"], label: "Delhi" },
    { terms: ["mumbai", "bombay"], label: "Mumbai" },
    { terms: ["jaipur"], label: "Jaipur" },
    { terms: ["bangalore", "bengaluru"], label: "Bengaluru" },
    { terms: ["pune"], label: "Pune" },
    { terms: ["kolkata", "calcutta"], label: "Kolkata" },
    { terms: ["chennai", "madras"], label: "Chennai" },
    { terms: ["hyderabad"], label: "Hyderabad" },
    { terms: ["paris"], label: "Paris" },
    { terms: ["london"], label: "London" },
    { terms: ["new york", "nyc"], label: "New York" },
  ];
  const peopleRules = [
    { terms: ["friend", "friends"], label: "Friends" },
    { terms: ["family"], label: "Family" },
    { terms: ["parent", "parents", "mom", "mum", "dad"], label: "Parents" },
    { terms: ["partner", "husband", "wife", "boyfriend", "girlfriend"], label: "Partner" },
    { terms: ["colleague", "colleagues", "coworker", "coworkers"], label: "Colleagues" },
  ];
  const objectRules = [
    { terms: ["car", "vehicle"], label: "Car" },
    { terms: ["phone", "mobile"], label: "Phone" },
    { terms: ["medicine", "medication", "tablet"], label: "Medicine" },
    { terms: ["receipt", "bill"], label: "Receipt" },
    { terms: ["document", "paperwork"], label: "Document" },
    { terms: ["food", "meal", "dish"], label: "Food" },
    { terms: ["laptop", "computer"], label: "Laptop" },
  ];
  const situationRules = [
    { terms: ["trip", "holiday", "vacation"], label: "Trip" },
    { terms: ["restaurant", "dinner", "lunch"], label: "Restaurant" },
    { terms: ["café", "cafe", "coffee shop"], label: "Café" },
    { terms: ["trek", "trekking", "hike", "hiking"], label: "Trek" },
    { terms: ["office", "workplace"], label: "Office" },
    { terms: ["beach", "sea", "coast", "ocean"], label: "Beach" },
  ];

  const festivals = labelsFor(festivalRules);
  const events = labelsFor(eventRules);
  const locations = labelsFor(locationRules);
  const people = labelsFor(peopleRules);
  const objects = labelsFor(objectRules);
  const situations = labelsFor(situationRules);
  const year = value.match(/\b(19|20)\d{2}\b/)?.[0];
  const relativeYear =
    hasTerm("two years ago") ? String(currentYear - 2)
    : hasTerm("last year") || hasTerm("one year ago") ? String(currentYear - 1)
    : hasTerm("this year") ? String(currentYear)
    : undefined;
  const dateClue = year ?? relativeYear;
  const hasPhotoWord = ["photo", "pic", "picture", "image", "selfie"].some(hasTerm);
  const hasEvent = festivals.length > 0 || events.length > 0;
  const eventCategory = festivals.length ? "Festival / Event" : events.length ? "Event" : undefined;
  const contextualClues = hasEvent
    ? [...festivals, ...events, ...(dateClue ? [dateClue] : []), ...(eventCategory ? [eventCategory] : []), ...(hasPhotoWord ? ["Photo"] : []), ...locations, ...people, ...objects, ...situations]
    : [...locations, ...people, ...situations, ...(dateClue ? [dateClue] : []), ...objects, ...(hasPhotoWord ? ["Photo"] : [])];
  const clues = Array.from(new Set(contextualClues));
  const location = locations[0];
  const setting = situations.find((clue) => ["Café", "Restaurant", "Office", "Beach"].includes(clue));
  const hasDate = Boolean(dateClue);
  const hasPeople = people.length > 0;
  const hasVisualContext = objects.length > 0 || situations.some((clue) => ["Beach", "Restaurant", "Café", "Trek"].includes(clue));
  const nextQuestion: QuestionKind =
    hasEvent && hasDate && !hasPeople ? "people"
    : hasEvent && hasPeople && !location ? "location"
    : location && hasEvent && !hasDate ? "date"
    : !hasDate ? "date"
    : !hasPeople ? "people"
    : !location ? "location"
    : "visual";
  const uncertainLabels: Record<QuestionKind, string> = {
    date: "Date",
    location: "Location",
    people: "People",
    visual: "Visual details",
  };

  return {
    clues,
    uncertain: [uncertainLabels[nextQuestion]],
    location,
    setting,
    hasDate,
    hasEvent,
    hasPeople,
    hasVisualContext,
    nextQuestion,
  };
}

function buildQuestions(parsed: ParsedMemory): Question[] {
  const questionPool: Question[] = [
    {
      kind: "date",
      prompt: "Do you remember roughly when this happened?",
      helper: "Even an approximate year can make a big difference.",
      options: [String(new Date().getFullYear() - 2), String(new Date().getFullYear() - 1), String(new Date().getFullYear()), "Not sure"],
      clue: (answer) => (answer.match(/^\d{4}$/) ? answer : null),
    },
    {
      kind: "location",
      prompt:
        parsed.setting === "Café" && parsed.location
          ? `Do you remember where the café was in ${parsed.location}?`
          : parsed.location
            ? `Do you remember where in ${parsed.location} this was?`
            : "Do you remember roughly where this happened?",
      helper: "A nearby landmark or type of area is enough.",
      options: ["Near the beach", "Town centre", "Hotel or resort", "Not sure"],
      clue: (answer) => (answer === "Not sure" ? null : answer),
    },
    {
      kind: "people",
      prompt: "Who was with you?",
      helper: "Choose the closest match.",
      options: ["Friends", "Family", "Partner", "By myself", "Not sure"],
      clue: (answer) => (answer === "Not sure" ? null : answer),
    },
    {
      kind: "visual",
      prompt: "What do you remember seeing in the photo?",
      helper: "A visual detail can separate otherwise similar moments.",
      options: ["Beach or sea", "Buildings or streets", "Greenery", "Food or table", "Not sure"],
      clue: (answer) => (answer === "Not sure" ? null : answer),
    },
  ];

  const prioritized = questionPool.find((question) => question.kind === parsed.nextQuestion);
  const missing = questionPool.filter((question) => {
    if (question.kind === "date") return !parsed.hasDate;
    if (question.kind === "people") return !parsed.hasPeople;
    if (question.kind === "visual") return !parsed.hasVisualContext;
    return true;
  });
  const ordered = [
    ...(prioritized ? [prioritized] : []),
    ...missing.filter((question) => question !== prioritized),
    ...questionPool.filter((question) => question !== prioritized && !missing.includes(question)),
  ];
  return ordered.slice(0, 3);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [memory, setMemory] = useState("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [returnNote, setReturnNote] = useState(false);

  const parsedMemory = useMemo(() => parseMemory(memory), [memory]);
  const initialClues = parsedMemory.clues;
  const questions = useMemo(() => buildQuestions(parsedMemory), [parsedMemory]);
  const answerClues = useMemo(
    () =>
      questions
        .map((question, index) => (answers[index] ? question.clue(answers[index]) : null))
        .filter((clue): clue is string => Boolean(clue)),
    [answers, questions],
  );
  const allClues = useMemo(() => Array.from(new Set([...initialClues, ...answerClues])), [initialClues, answerClues]);

  useEffect(() => {
    if (screen !== "processing") return;
    const timer = window.setTimeout(() => setScreen("understanding"), 1100);
    return () => window.clearTimeout(timer);
  }, [screen]);

  const startSearch = () => {
    if (!memory.trim()) return;
    setScreen("processing");
  };

  const chooseAnswer = (answer: string) => {
    setAnswers((current) => ({ ...current, [questionIndex]: answer }));
    setReturnNote(false);
  };

  const continueQuestion = () => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
    } else {
      setScreen("refined");
    }
  };

  const startOver = () => {
    setMemory("");
    setAnswers({});
    setQuestionIndex(0);
    setSelectedCandidate(null);
    setReturnNote(false);
    setScreen("welcome");
  };

  if (screen === "welcome") {
    return (
      <AppShell quiet>
        <section className="welcome">
          <div className="ambient ambient-one" />
          <div className="ambient ambient-two" />
          <div className="eyebrow"><SparkIcon /> Guided photo discovery</div>
          <h1>Find the photo<br />you remember.</h1>
          <p className="lead">Describe the memory naturally. You don&apos;t need the exact date, place, or filename.</p>
          <div className="memory-composer">
            <label htmlFor="memory">What do you remember?</label>
            <textarea
              id="memory"
              value={memory}
              onChange={(event) => setMemory(event.target.value)}
              placeholder="I'm looking for a photo from my Goa trip where my friends and I were sitting at a small café."
              rows={4}
              autoFocus
            />
            <div className="composer-bottom">
              <span><SparkIcon /> Describe people, places, or a feeling</span>
              <button className="primary compact" onClick={startSearch} disabled={!memory.trim()}>
                Start finding <ArrowIcon />
              </button>
            </div>
          </div>
          <p className="reassurance">Memory Guide uses your clues to ask the most useful questions.</p>
          <div className="flow-preview" aria-label="How Memory Guide works">
            <span>Describe</span><i /><span>Clarify</span><i /><span>Recognize</span>
          </div>
        </section>
      </AppShell>
    );
  }

  if (screen === "processing") {
    return (
      <AppShell quiet>
        <section className="center-stage processing">
          <div className="thinking-orbit"><SparkIcon /><i /><i /><i /></div>
          <p className="kicker">Reading between the details</p>
          <h2>Making sense of your memory…</h2>
          <p>Finding the clues that can bring you closer.</p>
        </section>
      </AppShell>
    );
  }

  if (screen === "understanding") {
    return (
      <AppShell>
        <section className="content-stage understanding">
          <div className="step-label">Your memory, understood</div>
          <h2>Here&apos;s what I understood</h2>
          <p className="subtitle">These are the details that stood out in your description.</p>
          <div className="clue-card">
            <div className="clue-card-top">
              <span className="mini-icon"><SparkIcon /></span>
              <span className="quote">{memory}</span>
            </div>
            <div className="chip-row">
              {initialClues.map((clue) => <ClueChip key={clue}>{clue}</ClueChip>)}
            </div>
            <div className="uncertain-row">
              <span>Still uncertain</span>
              <div>{parsedMemory.uncertain.map((item) => <span key={item}>{item}</span>)}</div>
            </div>
          </div>
          <div className="need-row">
            <div>
              <p className="kicker">What I still need to know</p>
              <h3>One more clue could narrow this down.</h3>
              <p>I have enough context to start. I&apos;ll ask only what&apos;s useful.</p>
            </div>
            <button className="primary" onClick={() => setScreen("questions")}>Continue <ArrowIcon /></button>
          </div>
        </section>
      </AppShell>
    );
  }

  if (screen === "questions") {
    const question = questions[questionIndex];
    const selected = answers[questionIndex];
    return (
      <AppShell>
        <section className="question-layout">
          <aside className="memory-sidebar">
            <p className="kicker">Memory so far</p>
            <h3>{memory}</h3>
            <div className="sidebar-chips">
              {allClues.map((clue) => <ClueChip key={clue}>{clue}</ClueChip>)}
            </div>
            <div className="progress-block">
              <div><span>{questionIndex + 1} of 3 clues</span><span>{Math.round(((questionIndex + 1) / 3) * 100)}%</span></div>
              <div className="progress-track"><i style={{ width: `${((questionIndex + 1) / 3) * 100}%` }} /></div>
            </div>
          </aside>
          <div className="question-panel">
            {returnNote && <div className="return-note"><SparkIcon /><span><strong>Let&apos;s use another clue.</strong> A different answer may reveal better matches.</span></div>}
            <span className="question-number">Question {questionIndex + 1}</span>
            <h2>{question.prompt}</h2>
            <p>{question.helper}</p>
            <p className="why-line"><SparkIcon /> Why I&apos;m asking: this clue can help narrow down similar photos.</p>
            <div className={`option-grid ${questionIndex === 2 ? "chips" : ""}`}>
              {question.options.map((option) => (
                <button
                  key={option}
                  className={selected === option ? "selected" : ""}
                  onClick={() => chooseAnswer(option)}
                >
                  <span>{option}</span>
                  <i>{selected === option && <CheckIcon />}</i>
                </button>
              ))}
            </div>
            <button className="forget-button" onClick={() => chooseAnswer("I don't remember")}>I don&apos;t remember</button>
            <div className="question-actions">
              <button className="text-button" onClick={() => questionIndex ? setQuestionIndex(questionIndex - 1) : setScreen("understanding")}>Back</button>
              <button className="primary" disabled={!selected} onClick={continueQuestion}>
                {questionIndex === 2 ? "Review my clues" : "Next question"} <ArrowIcon />
              </button>
            </div>
          </div>
        </section>
      </AppShell>
    );
  }

  if (screen === "refined") {
    return (
      <AppShell>
        <section className="center-stage refined">
          <div className="success-mark"><CheckIcon /></div>
          <p className="kicker">Memory refined</p>
          <h2>We narrowed down<br />your memory</h2>
          <p>Based on these clues, here are the most likely memories.</p>
          <div className="refined-card">
            <div className="chip-row">
              {allClues.map((clue) => <ClueChip key={clue}>{clue}</ClueChip>)}
            </div>
            <div className="summary-line">{allClues.join(" · ")}</div>
          </div>
          <div className="stacked-actions">
            <button className="primary wide" onClick={() => setScreen("results")}>Show likely photos <ArrowIcon /></button>
            <button className="text-button" onClick={() => { setQuestionIndex(0); setScreen("questions"); }}>Change a clue</button>
          </div>
        </section>
      </AppShell>
    );
  }

  if (screen === "results") {
    return (
      <AppShell>
        <section className="results-stage">
          <div className="results-heading">
            <div>
              <p className="kicker">6 possible memories</p>
              <h2>Which one looks closest to<br />what you remember?</h2>
            </div>
            <div className="results-clues">{allClues.slice(0, 5).map((clue) => <span key={clue}>{clue}</span>)}</div>
          </div>
          <div className="photo-grid">
            {candidates.map((candidate, index) => (
              <button
                className="candidate"
                key={`${candidate.place}-${candidate.detail}`}
                onClick={() => { setSelectedCandidate(index); setScreen("success"); }}
              >
                <div className="image-wrap">
                  <PhotoPlaceholder variant={candidate.style} src={candidate.image} alt={candidate.alt} />
                  <span className="match">{candidate.match}</span>
                  <span className="select-hint">This looks familiar <ArrowIcon /></span>
                </div>
                <div className="candidate-info">
                  <div><strong>{candidate.place}</strong><span>{candidate.detail}</span></div>
                  <span>{candidate.time}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="none-row">
            <span>Not seeing it yet?</span>
            <button onClick={() => { setQuestionIndex(0); setReturnNote(true); setScreen("questions"); }}>None of these — use another clue</button>
          </div>
        </section>
      </AppShell>
    );
  }

  const candidate = candidates[selectedCandidate ?? 0];
  return (
    <AppShell>
      <section className="success-stage">
        <div className="found-copy">
          <div className="success-mark"><CheckIcon /></div>
          <p className="kicker">Search complete</p>
          <h2>Memory found</h2>
          <p className="subtitle">This looks like the photo you were trying to remember.</p>
          <p className="reconstructed-note">Your memory was reconstructed using the clues you provided.</p>
          <div className="helped">
            <h3>What helped narrow it down?</h3>
            <div className="chip-row">{allClues.map((clue) => <ClueChip key={clue}>{clue}</ClueChip>)}</div>
          </div>
          <button className="primary" onClick={startOver}>Search another memory <ArrowIcon /></button>
        </div>
        <div className="selected-photo">
          <PhotoPlaceholder variant={candidate.style} src={candidate.image} alt={candidate.alt} />
          <div>
            <span><strong>{candidate.place}</strong>{candidate.detail} · {candidate.time}</span>
            <span className="match static">{candidate.match}</span>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
