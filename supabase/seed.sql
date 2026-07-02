-- AIAC Platform — demo seed (mirrors the production demo data)
-- The governed 37-competency framework with behavioural indicators, demo accounts,
-- two published assessments, and pre-scored candidate journeys so every screen has
-- data on first login. All demo accounts use the password: Demo12345!
-- Run after supabase/migrations/0001_schema.sql.

-- ---------- Organization ----------

insert into public.organizations (id, name, business_unit)
values ('0a000000-0000-4000-8000-000000000001', 'Azerconnect Group', 'HQ / HR Strategy')
on conflict (id) do nothing;

-- ---------- The governed 37-competency framework ----------

insert into public.competencies (code, name, category, is_mandatory, description) values
  -- Core (4, mandatory)
  ('CF-C01', 'Innovating', 'Core', true, 'The ability to think creatively, challenge existing practices, and develop new ideas or approaches that drive improvement, efficiency, and positive change.'),
  ('CF-C02', 'Collaborative', 'Core', true, 'The ability to work effectively and cooperatively with others—across teams, departments, or organizations—to achieve common goals.'),
  ('CF-C03', 'Leading Through Change', 'Core', true, 'The ability to guide, support, and inspire individuals and teams through periods of change by providing clear direction and fostering resilience.'),
  ('CF-C04', 'Resourcefulness', 'Core', true, 'The ability to find quick and clever ways to solve problems using available resources effectively, showing adaptability and initiative.'),
  -- Leadership (2, mandatory)
  ('CF-L01', 'Engages & Inspires', 'Leadership', true, 'The ability to motivate others by communicating a compelling vision, fostering enthusiasm, and creating a sense of purpose and commitment.'),
  ('CF-L02', 'Drives Vision & Purpose', 'Leadership', true, 'Ability to inspire others by creating and communicating a clear, compelling vision of the future that motivates action and alignment.'),
  -- Functional (31)
  ('CF-F01', 'Business Acumen', 'Functional', false, 'The ability to understand and apply knowledge of the organization''s operations, strategy, and financial drivers to align initiatives with business goals.'),
  ('CF-F02', 'Problem Solving & Critical Thinking', 'Functional', false, 'The ability to identify, analyze, and evaluate problems or situations, and apply logical thinking to develop effective solutions.'),
  ('CF-F03', 'Analysis', 'Functional', false, 'The ability to collect, interpret, and evaluate data or information to identify patterns, draw logical conclusions, and support sound decision-making.'),
  ('CF-F04', 'Strategic Relationship Building & Stakeholder Engagement', 'Functional', false, 'From building professional relationships to developing strategic, long-term relationships that influence organizational priorities.'),
  ('CF-F05', 'Accountability', 'Functional', false, 'The ability to take ownership of one''s actions, responsibilities, and outcomes, consistently delivering results.'),
  ('CF-F06', 'Discipline', 'Functional', false, 'The ability to consistently adhere to rules, processes, and standards while demonstrating self-control, focus, and persistence.'),
  ('CF-F07', 'Strategic Thinking', 'Functional', false, 'The ability to anticipate future trends, assess complex situations, and make informed decisions aligned with long-term goals.'),
  ('CF-F08', 'Innovation Mindset', 'Functional', false, 'The ability to generate, embrace, and apply new ideas, approaches, and solutions that improve processes, products, or outcomes.'),
  ('CF-F09', 'Problem Solving', 'Functional', false, 'The ability to identify, analyze, and resolve challenges effectively by applying logical thinking, creativity, and sound judgment.'),
  ('CF-F10', 'Effective Communication', 'Functional', false, 'As authored in source (see DQ-01 data-quality note): description text currently mismatched in source with Business Acumen.'),
  ('CF-F11', 'Decision-Making Under Pressure', 'Functional', false, 'The ability to make timely, well-considered decisions in high-pressure or time-sensitive situations while balancing risks and outcomes.'),
  ('CF-F12', 'Critical Thinking', 'Functional', false, 'The ability to objectively analyze information, identify underlying issues, evaluate evidence, and make logical, well-reasoned decisions.'),
  ('CF-F13', 'Judgement and Foresight', 'Functional', false, 'The ability to make well-informed decisions by anticipating potential risks, opportunities, and long-term consequences.'),
  ('CF-F14', 'Attention to Detail', 'Functional', false, 'The ability to thoroughly and accurately complete tasks by focusing on all aspects of the work and identifying errors or inconsistencies.'),
  ('CF-F15', 'Integrity and Ethics', 'Functional', false, 'The ability to consistently act in accordance with moral and organizational values, demonstrating honesty, fairness, and transparency.'),
  ('CF-F16', 'Customer Centricity', 'Functional', false, 'The ability to understand, anticipate, and prioritize customer needs and expectations, delivering value-driven solutions.'),
  ('CF-F17', 'Design Thinking', 'Functional', false, 'The ability to apply a human-centered, creative, and iterative approach to problem-solving.'),
  ('CF-F18', 'Analytical Thinking', 'Functional', false, 'The ability to systematically gather, interpret, and evaluate information to identify patterns, root causes, and insights.'),
  ('CF-F19', 'Agility & Adaptability', 'Functional', false, 'The ability to remain flexible, resilient, and effective in changing environments by adjusting priorities and behaviors.'),
  ('CF-F20', 'Data-Driven Decision Making', 'Functional', false, 'The ability to collect, analyze, and interpret data to guide decisions, optimize outcomes, and drive strategic, evidence-based actions.'),
  ('CF-F21', 'Agility', 'Functional', false, 'The ability to quickly adapt to change, remain flexible under pressure, and effectively respond to new challenges and priorities.'),
  ('CF-F22', 'Initiative', 'Functional', false, 'The ability to proactively identify opportunities, take ownership of tasks, and act independently to achieve results.'),
  ('CF-F23', 'Result Orientation', 'Functional', false, 'The ability to focus on achieving high-quality outcomes by setting clear goals and consistently delivering tangible results.'),
  ('CF-F24', 'Strategic Sourcing and Negotiation Skills', 'Functional', false, 'The ability to effectively identify, evaluate, and select suppliers or partners while negotiating optimal agreements.'),
  ('CF-F25', 'Analytical and Financial Acumen', 'Functional', false, 'The ability to interpret data, financial information, and business metrics to make informed decisions and optimize resources.'),
  ('CF-F26', 'Supplier Relationship and Risk Management', 'Functional', false, 'The ability to build and maintain strong partnerships with suppliers while identifying, assessing, and mitigating risks.'),
  ('CF-F27', 'Service Orientation', 'Functional', false, 'The ability to understand and anticipate the needs of customers or stakeholders and consistently deliver high-quality support.'),
  ('CF-F28', 'Critical Thinking and Decision Making', 'Functional', false, 'The ability to analyze information objectively, evaluate options, anticipate potential outcomes, and make informed decisions.'),
  ('CF-F29', 'Critical Thinking and Inquiry', 'Functional', false, 'The ability to question assumptions, analyze information objectively, and explore alternatives to solve problems.'),
  ('CF-F30', 'Time Management', 'Functional', false, 'The ability to plan, prioritize, and organize tasks effectively to optimize productivity and meet deadlines.'),
  ('CF-F31', 'Multitasking', 'Functional', false, 'The ability to efficiently manage and prioritize multiple tasks or responsibilities simultaneously while maintaining accuracy and quality.')
on conflict (name) do nothing;

-- Behavioural indicators (Basic / Skilled / Expert anchors)
insert into public.competency_indicators (competency_id, level, indicator_text) values
  ((select id from public.competencies where code = 'CF-C01'), 'Basic', 'Demonstrates openness to change; shares observations that could lead to small improvements; applies known solutions in new ways to routine problems.'),
  ((select id from public.competencies where code = 'CF-C01'), 'Skilled', 'Proactively identifies opportunities for innovation beyond immediate tasks; develops and tests new ideas; analyzes risks and benefits before implementing new methods.'),
  ((select id from public.competencies where code = 'CF-C01'), 'Expert', 'Drives a culture of innovation by inspiring and mentoring others; anticipates future trends; leads complex innovation initiatives involving cross-functional collaboration.'),
  ((select id from public.competencies where code = 'CF-C02'), 'Basic', 'Consistently collaborates well with others, shares information openly, respects diverse opinions, and contributes positively to team goals.'),
  ((select id from public.competencies where code = 'CF-C02'), 'Skilled', 'Communicates openly, supports colleagues, contributes actively to teamwork, and helps resolve issues constructively.'),
  ((select id from public.competencies where code = 'CF-C03'), 'Basic', 'Demonstrates openness to change, adapts work processes proactively, and supports colleagues during transitions.'),
  ((select id from public.competencies where code = 'CF-C03'), 'Skilled', 'Proactively communicates change, addresses concerns empathetically, helps team members adapt, and maintains motivation.'),
  ((select id from public.competencies where code = 'CF-C04'), 'Basic', 'Consistently uses available resources to solve routine problems; demonstrates initiative and seeks help when appropriate.'),
  ((select id from public.competencies where code = 'CF-C04'), 'Skilled', 'Consistently solves problems independently by effectively using a range of tools, resources, and approaches in moderately complex situations.'),
  ((select id from public.competencies where code = 'CF-L01'), 'Basic', 'Shows enthusiasm and positive attitude; listens actively and responds respectfully; shares information clearly.'),
  ((select id from public.competencies where code = 'CF-L01'), 'Skilled', 'Communicates a clear, compelling vision aligned with team/organizational goals; consistently demonstrates enthusiasm and optimism.'),
  ((select id from public.competencies where code = 'CF-L02'), 'Basic', 'Demonstrates understanding of organizational vision and goals; aligns individual work with team direction.'),
  ((select id from public.competencies where code = 'CF-L02'), 'Skilled', 'Clearly communicates how team/individual goals align with organizational mission; helps others see contribution to long-term outcomes.')
on conflict do nothing;

-- ---------- Demo accounts (password: Demo12345!) ----------

do $$
declare
  ids uuid[] := array[
    'a0000000-0000-4000-8000-000000000001', -- recruiter / HR admin
    'a0000000-0000-4000-8000-000000000003', -- demo candidate (fresh invitation)
    'a1000000-0000-4000-8000-000000000001', -- Leyla  (reviewed, shortlist)
    'a1000000-0000-4000-8000-000000000002', -- Rashad (in progress)
    'a1000000-0000-4000-8000-000000000003'  -- Tural  (reviewed, reject)
  ];
  emails text[] := array[
    'recruiter@aiac-demo.com', 'candidate@aiac-demo.com',
    'leyla.mammadova@aiac-demo.com', 'rashad.aliyev@aiac-demo.com', 'tural.karimov@aiac-demo.com'
  ];
  names text[] := array[
    'Demo Recruiter', 'Demo Candidate', 'Leyla Mammadova', 'Rashad Aliyev', 'Tural Karimov'
  ];
  roles text[] := array['hr_admin', 'candidate', 'candidate', 'candidate', 'candidate'];
  i int;
begin
  for i in 1..array_length(ids, 1) loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      ids[i], '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      emails[i], extensions.crypt('Demo12345!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', names[i], 'role', roles[i]),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (ids[i]::text, ids[i], jsonb_build_object('sub', ids[i]::text, 'email', emails[i], 'email_verified', true), 'email', now(), now(), now())
    on conflict (provider_id, provider) do nothing;

    insert into public.profiles (id, email, full_name, role)
    values (ids[i], emails[i], names[i], roles[i]::public.user_role)
    on conflict (id) do nothing;
  end loop;
end $$;

-- ---------- Assessment 1: Manager Readiness ----------

insert into public.assessments (id, organization_id, title, description, time_limit_minutes, created_by, status, created_at) values
  ('b0000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Manager Readiness Assessment',
   'Measures readiness for people-management roles against the mandatory Core and Leadership competencies: innovating, collaboration, and engaging & inspiring others.',
   45, 'a0000000-0000-4000-8000-000000000001', 'published', now() - interval '21 days')
on conflict (id) do nothing;

insert into public.assessment_sections (id, assessment_id, title, competency_id, sequence) values
  ('c0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000001', 'Innovating', (select id from public.competencies where code = 'CF-C01'), 1),
  ('c0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000001', 'Collaborative', (select id from public.competencies where code = 'CF-C02'), 2),
  ('c0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000001', 'Engages & Inspires (Leadership)', (select id from public.competencies where code = 'CF-L01'), 3)
on conflict (id) do nothing;

insert into public.questions (id, section_id, question_type, prompt, options, weight, sequence) values
  ('d0000000-0000-4000-8000-000000000111', 'c0000000-0000-4000-8000-000000000011', 'mcq',
   'A recurring process in your team is slow and error-prone. What is the BEST first step?',
   '[{"key":"A","text":"Keep using the existing process to avoid disruption","correct":false},
     {"key":"B","text":"Analyze the root cause and propose a small, testable improvement","correct":true},
     {"key":"C","text":"Escalate immediately and wait for management to decide","correct":false},
     {"key":"D","text":"Ignore it since it is not your direct responsibility","correct":false}]'::jsonb, 1, 1),
  ('d0000000-0000-4000-8000-000000000112', 'c0000000-0000-4000-8000-000000000011', 'text',
   'Describe a time you proactively identified an opportunity for improvement and implemented a new idea, even though it was outside your immediate tasks. What was the outcome?', null, 2, 2),
  ('d0000000-0000-4000-8000-000000000121', 'c0000000-0000-4000-8000-000000000012', 'mcq',
   'A colleague on another team disagrees with your approach in a shared project. What do you do?',
   '[{"key":"A","text":"Insist on your approach since you know it is correct","correct":false},
     {"key":"B","text":"Listen to their perspective, discuss openly, and find common ground","correct":true},
     {"key":"C","text":"Avoid the conversation and proceed independently","correct":false},
     {"key":"D","text":"Escalate to your manager without discussing directly first","correct":false}]'::jsonb, 1, 1),
  ('d0000000-0000-4000-8000-000000000122', 'c0000000-0000-4000-8000-000000000012', 'text',
   'Describe a time when you worked as part of a team. What was your role, and how did you contribute to the team''s success?', null, 2, 2),
  ('d0000000-0000-4000-8000-000000000131', 'c0000000-0000-4000-8000-000000000013', 'text',
   'Tell me about a time you motivated a team or colleague during a difficult period. What did you say or do, and what was the impact?', null, 2, 1),
  ('d0000000-0000-4000-8000-000000000132', 'c0000000-0000-4000-8000-000000000013', 'mcq',
   'Your team''s morale is low after a setback. What is the MOST effective response?',
   '[{"key":"A","text":"Acknowledge the setback, share a clear path forward, and recognise individual contributions","correct":true},
     {"key":"B","text":"Avoid discussing it and move straight to the next task","correct":false},
     {"key":"C","text":"Assign blame to identify what went wrong","correct":false},
     {"key":"D","text":"Wait for morale to improve on its own","correct":false}]'::jsonb, 1, 2)
on conflict (id) do nothing;

-- ---------- Assessment 2: Graduate Programme ----------

insert into public.assessments (id, organization_id, title, description, time_limit_minutes, created_by, status, created_at) values
  ('b1000000-0000-4000-8000-000000000001', '0a000000-0000-4000-8000-000000000001',
   'Graduate Programme — Core Competency Assessment',
   'For graduate applicants: resourcefulness, leading through change, and effective communication, measured against the governed Core and Functional competency anchors.',
   40, 'a0000000-0000-4000-8000-000000000001', 'published', now() - interval '5 days')
on conflict (id) do nothing;

insert into public.assessment_sections (id, assessment_id, title, competency_id, sequence) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Resourcefulness in practice', (select id from public.competencies where code = 'CF-C04'), 1),
  ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'Navigating change', (select id from public.competencies where code = 'CF-C03'), 2),
  ('c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'Communicating clearly', (select id from public.competencies where code = 'CF-F10'), 3)
on conflict (id) do nothing;

insert into public.questions (id, section_id, question_type, prompt, options, weight, sequence) values
  ('d1000000-0000-4000-8000-000000000011', 'c1000000-0000-4000-8000-000000000001', 'mcq',
   'You need data for a deadline tomorrow, but the only person with access is on leave. What is the BEST first move?',
   '[{"key":"A","text":"Wait for them to return and explain the delay afterwards","correct":false},
     {"key":"B","text":"Check what you can assemble from available sources, then ask the team lead for a fallback or interim access","correct":true},
     {"key":"C","text":"Ask a colleague to share the absent person''s credentials","correct":false},
     {"key":"D","text":"Deliver the report without the data and hope nobody notices","correct":false}]'::jsonb, 1, 1),
  ('d1000000-0000-4000-8000-000000000012', 'c1000000-0000-4000-8000-000000000001', 'text',
   'Describe a time you solved a problem with fewer resources, less time, or less information than you would have liked. What did you do, and what was the result?', null, 2, 2),
  ('d1000000-0000-4000-8000-000000000021', 'c1000000-0000-4000-8000-000000000002', 'text',
   'Tell us about a significant change (new tool, process, team, or plan) you had to adapt to quickly. How did you handle it, and how did you help others around you adapt?', null, 2, 1),
  ('d1000000-0000-4000-8000-000000000022', 'c1000000-0000-4000-8000-000000000002', 'mcq',
   'Your team''s priorities are reshuffled mid-quarter and your main project is paused. What do you do first?',
   '[{"key":"A","text":"Keep working on the paused project since the effort would otherwise be wasted","correct":false},
     {"key":"B","text":"Clarify the new priorities with your manager and re-plan your work around them","correct":true},
     {"key":"C","text":"Wait for detailed instructions before doing anything","correct":false},
     {"key":"D","text":"Voice disagreement with the change to your teammates","correct":false}]'::jsonb, 1, 2),
  ('d1000000-0000-4000-8000-000000000031', 'c1000000-0000-4000-8000-000000000003', 'mcq',
   'You must update three different audiences — engineers, executives, and a customer — on the same incident. What is the right approach?',
   '[{"key":"A","text":"Send everyone the same detailed technical timeline for consistency","correct":false},
     {"key":"B","text":"Tailor depth and framing to each audience while keeping the facts identical","correct":true},
     {"key":"C","text":"Brief only the executives and let the message cascade","correct":false},
     {"key":"D","text":"Wait until the incident is fully resolved before communicating anything","correct":false}]'::jsonb, 1, 1),
  ('d1000000-0000-4000-8000-000000000032', 'c1000000-0000-4000-8000-000000000003', 'text',
   'Describe a time you had to explain something complex to someone without that background. What did you do, and how did you know they actually understood?', null, 2, 2)
on conflict (id) do nothing;

-- ---------- Candidate journeys ----------

insert into public.candidate_assessments (id, assessment_id, candidate_id, status, overall_score, invited_at, started_at, submitted_at) values
  -- Leyla — reviewed, shortlisted
  ('e1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'reviewed', 86.7, now() - interval '9 days', now() - interval '8 days', now() - interval '8 days'),
  -- Rashad — currently in progress
  ('e1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
   'in_progress', null, now() - interval '2 days', now() - interval '3 hours', null),
  -- Tural — reviewed, rejected
  ('e1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003',
   'reviewed', 26.7, now() - interval '12 days', now() - interval '11 days', now() - interval '11 days'),
  -- Demo candidate — fresh invitation to the Graduate assessment (take it live!)
  ('e1000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003',
   'invited', null, now() - interval '1 day', null, null)
on conflict (id) do nothing;

insert into public.candidate_competency_scores (candidate_assessment_id, competency_id, score, level) values
  ('e1000000-0000-4000-8000-000000000001', (select id from public.competencies where code = 'CF-C01'), 86.7, 'Exceeds'),
  ('e1000000-0000-4000-8000-000000000001', (select id from public.competencies where code = 'CF-C02'), 83.3, 'Fully Meets'),
  ('e1000000-0000-4000-8000-000000000001', (select id from public.competencies where code = 'CF-L01'), 90, 'Exceeds'),
  ('e1000000-0000-4000-8000-000000000003', (select id from public.competencies where code = 'CF-C01'), 30, 'Does Not Meet'),
  ('e1000000-0000-4000-8000-000000000003', (select id from public.competencies where code = 'CF-C02'), 26.7, 'Does Not Meet'),
  ('e1000000-0000-4000-8000-000000000003', (select id from public.competencies where code = 'CF-L01'), 23.3, 'Does Not Meet');

insert into public.candidate_responses (candidate_assessment_id, question_id, response_text, selected_option, score, ai_rationale) values
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000111', null, 'B', 100, 'Selected option B, matching the validated correct answer.'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000112', 'Our onboarding checklist lived in scattered emails, so outside my project work I built a shared tracker with owners and deadlines, proposed it to my lead, and piloted it with two new joiners. Ramp-up time improved by about a week per hire and the tracker was adopted by the whole department.', null, 80, 'Phase-1 rule-based scoring: 54 words; 3 action-oriented and 3 outcome-oriented signal(s) detected against the Skilled-level anchors for Innovating. Initiative beyond immediate tasks with an adopted, measurable improvement.'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000121', null, 'B', 100, 'Selected option B, matching the validated correct answer.'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000122', 'In a five-person launch team I owned the reporting workstream. When our analyst fell ill a week before go-live, I redistributed the dashboard work, paired daily with the developer covering it, and we launched on schedule with all reports live.', null, 75, 'Phase-1 rule-based scoring: 43 words; 2 action-oriented and 2 outcome-oriented signal(s) detected against the Collaborative anchors. Clear personal role and constructive support of teammates under pressure.'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000131', 'After a failed audit, my team was demoralised. I organised a session where we mapped every finding to a concrete owner and a fix date, celebrated the two areas we had passed, and shared weekly progress. We closed all findings in six weeks and the re-audit passed.', null, 85, 'Phase-1 rule-based scoring: 49 words; 3 action-oriented and 3 outcome-oriented signal(s) detected against the Engages & Inspires anchors. Acknowledges the setback, gives a clear path forward, and lands a verifiable outcome.'),
  ('e1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000132', null, 'A', 100, 'Selected option A, matching the validated correct answer.'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000111', null, 'C', 0, 'Selected option C; validated correct answer is B. Escalating and waiting does not demonstrate the Innovating anchors. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000112', 'I usually follow the existing process because it is safer.', null, 45, 'Phase-1 rule-based scoring: 10 words; 0 action-oriented and 0 outcome-oriented signal(s) detected. No improvement opportunity or outcome described. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000121', null, 'D', 0, 'Selected option D; validated correct answer is B. Escalating before a direct conversation misses the Collaborative anchors. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000122', 'I worked in a team at university. I did my part of the project and we got a passing grade.', null, 40, 'Phase-1 rule-based scoring: 20 words; 0 action-oriented and 0 outcome-oriented signal(s) detected. Role and contribution not specific. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000131', 'I told a colleague things would get better eventually.', null, 35, 'Phase-1 rule-based scoring: 9 words; 0 action-oriented and 0 outcome-oriented signal(s) detected. No concrete motivating action or impact. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).'),
  ('e1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000132', null, 'D', 0, 'Selected option D; validated correct answer is A. Waiting for morale to recover on its own misses the Engages & Inspires anchors. Flagged for human reviewer confirmation (human-in-the-loop requirement, Part 4).');

insert into public.candidate_reviews (candidate_assessment_id, reviewer_id, decision, comment, created_at) values
  ('e1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'shortlist',
   'Consistently strong, evidence-backed answers with quantified outcomes across all three competencies. Proceed to panel interview.', now() - interval '7 days'),
  ('e1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'reject',
   'Answers stayed generic despite behavioural prompts; all three competencies below band. Encourage to reapply next cycle.', now() - interval '10 days');
