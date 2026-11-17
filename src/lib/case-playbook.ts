// The master prompt for writing assessment cases and questions. It is fed to
// the model for every generation, regeneration and case-library request, and a
// test (generation.prompt.test.ts) fails if any of its sections is removed.
//
// It is built from publicly published assessment-centre and situational-
// judgment practice (Hogan, Mercer|Mettl, WTW/Saville, Korn Ferry, McLean &
// Company) and never asks the model to reproduce anyone's actual items.
export const CASE_DESIGN_PLAYBOOK = `THE STANDARD. Every item must be good enough to survive review by a panel of assessment psychologists. If you would not defend an item in front of that panel, rewrite it before answering.

1. BUILD EACH CASE ON PRESSURE AND A REAL TRADE-OFF
- Start from a trigger: a deadline moved forward, a key person resigning, two reports that disagree, an escalation from a senior stakeholder, a budget or resource cut, a service incident, a change rollout meeting resistance, or an integrity gray area where a shortcut would relieve the pressure. Judgment differences between strong and weak performers show under strain, not on a calm day.
- Every case contains: (a) a specific situation with a named role for the candidate; (b) two to four stakeholders with different, legitimate priorities; (c) at least three concrete facts a good answer must use (a figure, a date, a constraint, a quoted remark); (d) one piece of missing or conflicting information; (e) a visible cost of doing nothing.
- Competing goods: at least two responses must be defensible. The best one wins because of a second-order effect (trust, precedent, risk, reversibility, speed of recovery), not because the others are silly.
- Cases are fiction. Invent scenario details freely (people, teams, figures, dates), but never name a real company, never state a real law, standard or statistic as fact, and never invent facts about the competency itself.
- Setting: realistic workplaces of an Azerbaijani telecom, technology and corporate-services group (network operations, customer care, enterprise sales, IT delivery, finance, HR, regional offices) unless the role information says otherwise. Use neutral or common Azerbaijani, Russian and international names, the local currency (AZN) and local working patterns where this adds realism.
- Use the scenario types that recur across assessment-centre practice: in-basket triage with conflicting priorities; a hard conversation with a previously strong or long-tenured team member; a cross-team priority or resource conflict; a decision on incomplete data; an ethical gray area; a change rollout facing visible resistance; explaining one decision to senior leaders and frontline staff at once.

2. FOUR-OPTION SITUATIONAL JUDGMENT ITEMS
- The stem ends with one precise question about one decision, for example "What is the most effective first action?" Never "which of these are true".
- Each wrong option is a named, realistic failure mode written as something a competent person might actually do: avoidance, over-control, appeasement, premature escalation, analysis paralysis, rule-bending, blame-shifting, or doing everything personally. Never a straw man.
- The keyed option is correct because it matches the target behavioural indicator, not because it is the longest, the most polite, the most hedged or the most process-heavy. Keep all four options within about 20% of the same length, in the same grammatical form and the same tone. The keyed option must not be the longest.
- Never use: "all of the above", "none of the above", absolute words (always, never, only) as a signal of a wrong answer, jargon that gives the answer away, or options that differ only in degree.
- Hard items (at least one in three): the two best options both look right at first reading, and the keyed one is separated by what it protects (the relationship after this week, the precedent, a risk that is hard to reverse).

3. OPEN-ENDED ITEMS THAT PRODUCE EVIDENCE
- Behavioural items ask for one specific past situation and what the candidate personally did. Situational items give a short case and ask what the candidate would do and why.
- Each open item asks for at most three things, in this order: the situation or decision; the action and the reasoning behind it; the result or what was given up. Do not stack more.
- Build probes into the wording: "what did you give up", "who disagreed and how did you respond", "how would you know it worked".
- No leading wording, no yes/no questions, nothing answerable with a textbook definition, nothing a candidate could answer well without having done the thing.

4. LEVEL AND INDICATOR DISCIPLINE
- Each question targets ONE named competency and ONE target-tier behavioural indicator. A strong answer must be recognisably that indicator in action. Calibrate difficulty to the level instructions: higher levels carry more stakeholders, more ambiguity, more figures and a higher cost of being wrong.
- Spread the set across situation types, stakeholders, parts of the business and difficulty. Never reuse a premise.

5. FAIRNESS, CLARITY AND INTEGRITY
- Make no assumptions about gender, age, religion, ethnicity, region, family status, disability or nationality. Do not rely on sports, cultural references, idioms or knowledge of a particular employer. Use plain, direct sentences that a non-native professional reader understands at first reading, and spell out any acronym that is not common.
- A case must need its own facts: a generic answer that ignores the figures, dates and people should score poorly. Do not ask for opinions on politics or policy.
- Never put the competency name, the indicator wording or a hint of the keyed answer in the stem.

6. SELF-CHECK BEFORE YOU ANSWER
Silently check every item against this list and rewrite any that fail: one competency and one target indicator; at least three concrete facts and one gap or conflict; a defensible second-best option; keyed option not the longest and not telegraphed; options parallel in length and form; no premise repeated; no stereotypes; no real company, law or statistic stated as fact; exactly one decision asked. Output only the final JSON.`;
