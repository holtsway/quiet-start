/* ============================================================================
   The Bridge — Companion Engine (Tier 0: Safe Mode, deterministic, local)
   Pure logic. No DOM, no network, no LLM. Works in the browser (window.BridgeEngine)
   and in Node (module.exports) so it can be unit-tested headlessly.

   Guardrails baked into the code (the "coherence constitution"):
   - Crisis routing is DETERMINISTIC and ALWAYS wins (never AI-judged).
   - Correction-acceptance: if the user negates/denies a feeling, we accept it,
     apologize, stop labeling, and suppress that emotion for the session.
   - No-repeat labeling: an emotion is named at most once; afterward we continue
     without re-asserting the label.
   - Word-boundary + negation-aware detection (no more "not angry" -> "angry").
   - Symptom/danger lane: supportive, routes to humans, NEVER diagnoses.
   ========================================================================== */
(function (root) {
  "use strict";

  function norm(t) { return (" " + String(t || "").toLowerCase() + " ").replace(/\s+/g, " "); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

  /* ---- 1. CRISIS (deterministic, always overrides) ---- */
  var CRISIS = [
    "kill myself", "killing myself", "suicide", "suicidal", "end it all", "end my life",
    "better off dead", "want to die", "wanna die", "take my life", "no reason to live",
    "not worth living", "don't want to be here", "dont want to be here", "hurt myself",
    "hurting myself", "kill me", "i want to die"
  ];
  function matchCrisis(t) { var s = norm(t); for (var i = 0; i < CRISIS.length; i++) { if (s.indexOf(CRISIS[i]) !== -1) return true; } return false; }

  /* ---- 2. NEGATION / CORRECTION ---- */
  var NEGATORS = /\b(not|never|aint|ain't|no longer|dont|don't|do not|didnt|didn't|did not|isnt|isn't|wasnt|wasn't|arent|aren't|stop saying|quit saying|never said|didnt say|didn't say|im not|i'm not|i am not)\b/;
  // generic "you got me wrong" with no emotion word
  var GENERAL_CORRECTION = /\b(i did ?n'?t say|i never said|that'?s not (what|right|true)|that is not (what|right|true)|you'?re wrong|you are wrong|stop (saying|assuming)|where did you get|why (would|do) you (say|think)|i didn'?t|i did not|don'?t put words)\b/;

  /* ---- 3. EMOTIONS (word-boundary, negation-aware) ---- */
  var EMOTIONS = [
    { key: "anger", re: /\b(angry|anger|mad|furious|fuming|pissed|livid|irate|rage|raging|enraged)\b/,
      reply: ["That anger makes sense — you don't have to soften it here.", "Sounds like something really got under your skin."],
      q: ["What's it pointing at?", "What's underneath it, if you sit with it a second?"] },
    { key: "sad", re: /\b(sad|down|depressed|miserable|heartbroken|grief|grieving|crying|cried|hurting|empty|numb)\b/,
      reply: ["That heaviness is real, and you don't have to carry it alone right now.", "I'm sorry it's sitting this heavy."],
      q: ["What's weighing on you most?", "When did it start feeling like this?"] },
    { key: "anxious", re: /\b(anxious|anxiety|scared|afraid|panic|panicking|panicked|nervous|terrified|on edge|freaking out|worried)\b/,
      reply: ["That kind of fear is exhausting to carry.", "It makes sense to feel on edge — this stuff is big."],
      q: ["What feels like the scariest part right now?", "Is there one small thing that would make today feel a little safer?"] },
    { key: "lonely", re: /\b(alone|lonely|isolated|by myself|on my own|no one|nobody)\b/,
      reply: ["Being alone with all of this is one of the hardest parts.", "Loneliness makes everything louder. You reached out, though — that counts."],
      q: ["Who in your life feels even a little safe to be near?", "When did you last feel less alone, even for a moment?"] },
    { key: "shame", re: /\b(ashamed|shame|guilty|guilt|embarrassed|worthless|failure|hate myself|disgusting|stupid|pathetic)\b/,
      reply: ["Shame is heavy, and it lies — it says you ARE the problem instead of someone going through one.", "You're being really hard on yourself. I'm not here to judge any of it."],
      q: ["Would you talk to a friend the way you're talking about yourself?", "What would it feel like to set that judgment down for a minute?"] },
    { key: "overwhelmed", re: /\b(overwhelmed|too much|can'?t cope|cant cope|drowning|falling apart|breaking down|so tired of|exhausted|burnt out|burned out)\b/,
      reply: ["That's a lot for anyone to hold at once.", "When it's all piled up, even small things feel impossible."],
      q: ["What's the heaviest piece right now?", "If one thing could lift, what would help most?"] }
  ];

  /* ---- 4. SYMPTOM / DANGER (supportive, routes to humans, never diagnoses) ---- */
  var SYMPTOM = /\b(chest pain|heart (is )?(racing|pounding)|can'?t breathe|cant breathe|shaking badly|seizure|overdose|od'd|throwing up blood|vomiting blood|withdrawal|withdrawals|dts|delirium|passed out|fainted|dizzy|how much .* too much|is (this|it|that) dangerous|am i (gonna|going to) (die|be okay)|will i be okay)\b/;

  /* ---- 5. HOPELESSNESS (soft — encourage human connection, not a label) ---- */
  var HOPELESS = /\b(hopeless|no point|what'?s the point|whats the point|giving up|gave up|nothing matters|no way out|can'?t go on|cant go on|what'?s the use)\b/;

  /* ---- 6. SUBSTANCE SAFETY NOTES (offered, never pushed) ---- */
  var NOTES = [
    { re: /\b(alcohol|drank|drink|drinking|beer|wine|vodka|whiskey|liquor|hungover|hangover|booze)\b/,
      q: "Want a quick, no-pressure note about alcohol and the body?",
      body: "A rough morning after drinking is mostly dehydration and your body clearing the alcohol — water, food, and rest help more than another drink. If you ever shake badly, sweat, or feel your heart racing when you cut back, that's a sign to talk to someone medical, because stopping heavy drinking suddenly can be dangerous. No judgment — just worth knowing." },
    { re: /\b(opioid|opioids|heroin|fentanyl|fent|oxy|percocet|dope|pills)\b/,
      q: "Want a quick safety note — no lecture?",
      body: "If you use opioids, naloxone (Narcan) can reverse an overdose and it's free at many LA County sites — having some nearby, and not using alone, saves lives. Tolerance drops fast after even a few days off, so a normal amount can become too much. You can ask the Service Helpline where to get naloxone near you." },
    { re: /\b(meth|stimulant|coke|cocaine|speed|crystal|adderall|uppers)\b/,
      q: "Want a quick note about what your body's doing?",
      body: "Stimulants keep you going past where your body would normally rest, so the crash — exhaustion, low mood, big hunger — is your body trying to catch up. Water, food, and sleep are the real recovery. If your chest hurts or your heart pounds hard, that's a reason to get checked." }
  ];

  /* ---- 7. THEMES (non-emotion topics) ---- */
  var THEMES = [
    { re: /\b(family|kids|son|daughter|wife|husband|mom|dad|mother|father|partner|girlfriend|boyfriend|brother|sister|friend)\b/,
      reply: ["The people we love are usually tangled up in all of this.", "Sounds like someone really matters in this."],
      q: ["What do you wish they understood?", "What kind of relationship do you want with them?"] },
    { re: /\b(money|job|work|rent|broke|bills|homeless|eviction|fired|unemployed|nowhere to)\b/,
      reply: ["That's a lot of real-world weight on top of everything else.", "When the basics feel shaky, it's hard to think about anything else."],
      q: ["What's the most pressing thing today?", "Would it help to see what's around you for that?"] },
    { re: /\b(sleep|tired|insomnia|awake|can'?t sleep|cant sleep|rest)\b/,
      reply: ["That kind of tired goes deeper than sleep sometimes.", "Running on empty makes everything heavier."],
      q: ["What's been keeping you up, if you know?", "What would real rest look like for you?"] },
    { re: /\b(relapse|relapsed|used again|slipped|drank again|got high|using again|craving|cravings|crave)\b/,
      reply: ["Thank you for being straight with me — that takes guts.", "A slip isn't the end of the road, and it doesn't erase the effort behind you."],
      q: ["What was going on right before?", "What do you want to do from here — there's no wrong answer?"] },
    { re: /\b(better|good|okay|fine|hopeful|proud|grateful|clean|sober|progress|made it)\b/,
      reply: ["I'm really glad to hear that. Steady moments deserve to be noticed too.", "That's worth holding onto. You did that."],
      q: ["What helped today go a little better?", "What would help that stick?"] }
  ];

  var CONTINUE = ["I'm still right here with you.", "Take your time — I'm listening.", "Go on, I'm with you.", "I hear you. Keep going if you want."];
  var OPEN_QS = ["What's weighing on you most right now?", "What made today feel the way it did?", "If one thing could feel a little lighter, what would it be?", "What do you need most in this moment?"];

  function isNegated(s, idx) {
    var before = s.slice(Math.max(0, idx - 28), idx);
    return NEGATORS.test(before);
  }
  // returns array of emotion keys that appear but are negated ("not angry")
  function negatedEmotions(t) {
    var s = norm(t), out = [];
    for (var i = 0; i < EMOTIONS.length; i++) {
      var m = s.match(EMOTIONS[i].re);
      if (m && isNegated(s, m.index)) out.push(EMOTIONS[i].key);
    }
    return out;
  }
  // first emotion present, NOT negated and NOT suppressed
  function detectEmotion(t, suppressed) {
    var s = norm(t); suppressed = suppressed || [];
    for (var i = 0; i < EMOTIONS.length; i++) {
      var e = EMOTIONS[i];
      if (suppressed.indexOf(e.key) !== -1) continue;
      var m = s.match(e.re);
      if (m && !isNegated(s, m.index)) return e;
    }
    return null;
  }
  function emoByKey(k) { for (var i = 0; i < EMOTIONS.length; i++) if (EMOTIONS[i].key === k) return EMOTIONS[i]; return null; }
  function matchNote(t) { var s = norm(t); for (var i = 0; i < NOTES.length; i++) if (NOTES[i].re.test(s)) return NOTES[i]; return null; }
  function matchTheme(t) { var s = norm(t); for (var i = 0; i < THEMES.length; i++) if (THEMES[i].re.test(s)) return THEMES[i]; return null; }

  /* ---- main: pure decision function ----
     ctx = { namedEmotions: [keys], suppressedEmotions: [keys] }
     returns intent {
       crisis, talk, bubbles[], emotion|null, repeat, correction,
       suppressAdd[], clearNamed, offerNugget:{q,body}|null
     }
  */
  function companionReply(text, ctx) {
    ctx = ctx || {}; var named = ctx.namedEmotions || [], supp = ctx.suppressedEmotions || [];
    var out = { crisis: false, talk: false, bubbles: [], emotion: null, repeat: false, correction: false, suppressAdd: [], clearNamed: false, offerNugget: null };
    var t = String(text || "");

    // 1. CRISIS — always first, always wins
    if (matchCrisis(t)) {
      out.crisis = true; out.talk = true;
      out.bubbles = ["I'm really glad you told me that. What you're feeling matters, and you deserve to talk to a real person right now — not a screen. Someone is there any time, day or night."];
      return out;
    }

    // 2. CORRECTION / NEGATION — accept, apologize, stop labeling, suppress
    var neg = negatedEmotions(t);
    if (neg.length || GENERAL_CORRECTION.test(norm(t))) {
      out.correction = true; out.clearNamed = true; out.suppressAdd = neg;
      out.bubbles = [pick([
        "You're right — I misread that, and I'm sorry. I don't want to put words on your experience.",
        "Thank you for correcting me — I shouldn't have assumed. I'm sorry."
      ]), pick([
        "Tell me, in your own words, what's actually going on?",
        "Let's start from what's true for you. What would you want me to know?"
      ])];
      return out;
    }

    // 3. SYMPTOM / DANGER — supportive, route to humans, never diagnose
    if (SYMPTOM.test(norm(t))) {
      out.talk = true;
      out.bubbles = [
        "I can't tell you what's medically going on — I'm not able to diagnose, and I wouldn't guess with something like this.",
        "But what you're describing is worth getting looked at by a real person. If it feels urgent, 911 is the right call. For anything substance-related, the Service Helpline can point you to medical help, 24/7."
      ];
      return out;
    }

    // 4. HOPELESSNESS — encourage human connection (not a label)
    if (HOPELESS.test(norm(t))) {
      out.talk = true;
      out.bubbles = [
        "That sounds so heavy — like you've been carrying it a long while. Feeling out of options is real, and it doesn't mean there are none.",
        "You don't have to sort it out alone. Would it help to hear a real voice? The people on the Service Helpline are kind, and they do this every day."
      ];
      return out;
    }

    // 5. EMOTION — label at most once; afterward continue without re-labeling
    var e = detectEmotion(t, supp);
    if (e) {
      out.emotion = e.key;
      if (named.indexOf(e.key) !== -1) { out.repeat = true; out.bubbles = [pick(CONTINUE), pick(e.q)]; }
      else { out.bubbles = [pick(e.reply), pick(e.q)]; }
      return out;
    }

    // 6. SUBSTANCE SAFETY NOTE — offered, not pushed
    var note = matchNote(t);
    if (note) {
      out.bubbles = [pick(["Thank you for being honest about that — it's not easy to say.", "I hear you. No judgment here at all."])];
      out.offerNugget = { q: note.q, body: note.body };
      return out;
    }

    // 7. THEME reflection
    var th = matchTheme(t);
    if (th) { out.bubbles = [pick(th.reply), pick(th.q)]; return out; }

    // 8. Fallback — listen + open question
    out.bubbles = [pick(["I'm listening.", "I'm here — take your time.", "Thank you for telling me that."]), pick(OPEN_QS)];
    return out;
  }

  var API = { companionReply: companionReply, matchCrisis: matchCrisis, negatedEmotions: negatedEmotions, detectEmotion: detectEmotion, _EMOTIONS: EMOTIONS };
  root.BridgeEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
