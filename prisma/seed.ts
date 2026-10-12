import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth";

const db = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const departments = [
  { name: "Computer Science & Engineering", code: "CSE", tagline: "Software, intelligence, and systems.", accent: "teal", sortOrder: 1 },
  { name: "Electrical & Computer Engineering", code: "ECE", tagline: "From circuits to signals.", accent: "sky", sortOrder: 2 },
  { name: "Business Administration", code: "BUS", tagline: "Ventures built on campus.", accent: "lime", sortOrder: 4 },
  { name: "Mechatronics & Robotics", code: "MRE", tagline: "Machines that move.", accent: "rose", sortOrder: 5 },
];

type SeedProject = {
  title: string; summary: string; description: string; category: string;
  year: number; semester: string; dept: string; supervisor: string; program: string;
  tags: string[]; demoUrl?: string; repoUrl?: string; featured?: boolean; views: number;
  techs: string[]; looking?: boolean;
  members: { name: string; role: string }[];
};

const projects: SeedProject[] = [
  {
    title: "CampusNav AR", summary: "Augmented-reality wayfinding that guides freshmen to any lecture hall through their phone camera.",
    description: "CampusNav AR overlays turn-by-turn directions on a live camera feed, making the campus legible on day one.\n\nThe system combines visual markers placed at building entrances with a lightweight AR engine running fully on-device, so it works even when the campus Wi-Fi is congested. Building routes are imported from the registrar's room database every night.\n\nIn a two-week pilot with 180 freshmen, first-visit navigation time to unfamiliar rooms dropped by 43%.",
    category: "Web & App", year: 2025, semester: "Spring", dept: "CSE", supervisor: "Prof. Dana Kim", program: "B.S. Computer Science",
    tags: ["ar", "mobile", "wayfinding"], demoUrl: "https://campusnav.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-cse/campusnav-ar",
    featured: true, views: 1284, techs: ["React", "TypeScript", "Figma", "Next.js"],
    members: [
      { name: "Jisoo Park", role: "OWNER" }, { name: "Minho Kang", role: "LEAD" },
      { name: "Aera Choi", role: "MEMBER" }, { name: "Tae Yang", role: "MEMBER" },
    ],
  },
  {
    title: "SignBridge", summary: "Real-time Korean Sign Language to speech translation powered by an on-device vision model.",
    description: "SignBridge watches a webcam feed and converts Korean Sign Language into natural spoken sentences with sub-second latency.\n\nA custom transformer trained on 92 hours of annotated KSL video handles continuous signing, not just isolated gestures. Everything runs locally — no video ever leaves the device, which mattered a lot to our testers in the accessibility office.\n\nThe team is now working with the university's disability services center on a semester-long deployment.",
    category: "AI & ML", year: 2025, semester: "Fall", dept: "CSE", supervisor: "Prof. Dana Kim", program: "B.S. Computer Science",
    tags: ["accessibility", "computer-vision", "on-device"], demoUrl: "https://signbridge.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-cse/signbridge",
    featured: true, views: 2011, techs: ["Python", "PyTorch", "OpenCV"],
    members: [
      { name: "Sora Lee", role: "OWNER" }, { name: "Hyun Woo", role: "LEAD" },
      { name: "Jae Min", role: "MEMBER" }, { name: "Eun Bi", role: "MEMBER" }, { name: "Daniel Seo", role: "MEMBER" },
    ],
  },
  {
    title: "StudyMate", summary: "A peer-matching PWA that groups students into focused study sessions by course and habit.",
    description: "StudyMate matches students taking the same courses and with similar study rhythms into small, accountable groups.\n\nThe matching algorithm blends course enrolment data with a short habit questionnaire, then schedules recurring sessions in campus libraries with real-time seat availability.\n\nOver one semester it hosted 640 sessions with a 71% weekly retention rate.",
    category: "Web & App", year: 2024, semester: "Spring", dept: "CSE", supervisor: "Dr. Hana Song", program: "B.S. Computer Science",
    tags: ["pwa", "matching"], demoUrl: "https://studymate.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-cse/studymate",
    views: 642, techs: ["Next.js", "PostgreSQL", "Node.js"], looking: true,
    members: [
      { name: "Kevin Ha", role: "OWNER" }, { name: "Yuna Ri", role: "LEAD" }, { name: "Bo Kyung", role: "MEMBER" },
    ],
  },
  {
    title: "GradAudit", summary: "A retrieval-augmented chatbot that answers graduation-check questions from the official handbook.",
    description: "GradAudit lets students ask questions like “do I still need a second-level foreign language credit?” and get grounded answers with citations to the exact handbook page.\n\nA RAG pipeline indexes the 140-page graduation handbook and department FAQ pages, refreshed whenever the registrar publishes updates.\n\nHallucination is kept in check with strict citation requirements — the bot refuses to answer anything it cannot source.",
    category: "AI & ML", year: 2026, semester: "Spring", dept: "CSE", supervisor: "Prof. Dana Kim", program: "B.S. Computer Science",
    tags: ["rag", "llm", "chatbot"], demoUrl: "https://gradaudit.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-cse/gradaudit",
    views: 318, techs: ["Python", "FastAPI", "PostgreSQL"],
    members: [
      { name: "Soo Ahn", role: "OWNER" }, { name: "Joon Ha", role: "MEMBER" },
    ],
  },
  {
    title: "SolarBench", summary: "A solar-powered smart campus bench that charges devices and reports seat usage to facilities.",
    description: "SolarBench is a campus bench with an integrated 60W solar panel, four USB-C ports, and a small e-ink status display.\n\nAn ESP32 monitors battery health, ambient temperature, and occupancy via capacitive sensing, streaming telemetry over LoRaWAN to a facilities dashboard.\n\nThree benches ran across campus for a full semester; the industrial design team from Design & Media built the weatherproof enclosure.",
    category: "IoT & Hardware", year: 2025, semester: "Year-long", dept: "ECE", supervisor: "Prof. Luis Marín", program: "B.Eng. Electrical Engineering",
    tags: ["solar", "esp32", "lorawan"], demoUrl: "https://solarbench.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-ece/solarbench",
    featured: true, views: 1547, techs: ["ESP32", "Arduino", "LoRaWAN"],
    members: [
      { name: "Chan Park", role: "OWNER" }, { name: "Da In", role: "LEAD" },
      { name: "Marcus Oh", role: "MEMBER" }, { name: "Nari Kim", role: "MEMBER" },
    ],
  },
  {
    title: "AirMesh", summary: "A 40-node air-quality mesh giving the campus a live, block-by-block pollution map.",
    description: "AirMesh deploys palm-sized PM2.5 / CO₂ sensor nodes on lampposts across campus, forming a self-healing mesh network.\n\nEach node costs under $30 to build, calibrates against a reference station weekly, and pushes readings to a public dashboard with 5-minute granularity.\n\nThe map caught two hotspots near loading docks and led facilities to reroute delivery vehicles.",
    category: "IoT & Hardware", year: 2024, semester: "Fall", dept: "ECE", supervisor: "Dr. Hana Song", program: "B.Eng. Electrical Engineering",
    tags: ["sensors", "mesh-network", "dashboard"], demoUrl: "https://airmesh.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-ece/airmesh",
    views: 893, techs: ["ESP32", "LoRaWAN", "Node.js"],
    members: [
      { name: "Woo Jin", role: "OWNER" }, { name: "Seo Yeon", role: "LEAD" }, { name: "In Ho", role: "MEMBER" },
    ],
  },
  {
    title: "SoundCheck", summary: "A dongle that measures real headphone exposure and nudges users before hearing damage accrues.",
    description: "SoundCheck is a USB-C audio dongle that measures actual output levels at the ear and computes a cumulative daily exposure score.\n\nA companion app visualizes exposure like a fitness tracker — daily budget, streaks, and gentle nudges when you cross 80%.\n\nAudiology students in the medical campus helped validate the acoustic measurements against clinical equipment.",
    category: "IoT & Hardware", year: 2023, semester: "Spring", dept: "ECE", supervisor: "Prof. Luis Marín", program: "B.Eng. Electrical Engineering",
    tags: ["audio", "health", "embedded"], views: 476, techs: ["Arduino", "Python"], demoUrl: "https://soundcheck.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-ece/soundcheck",
    members: [
      { name: "Ji Hoon", role: "OWNER" }, { name: "Hye Mi", role: "MEMBER" },
    ],
  },
  {
    title: "HAN-ROLL", summary: "A kinetic identity system and festival microsite for the university's spring arts week.",
    description: "HAN-ROLL is a rolling, physics-driven logotype that responds to scroll, tilt, and sound — built as the identity for spring arts week.\n\nThe microsite renders the identity in real time via WebGL, so every visitor's session produces a slightly different poster. Posters printed for campus halls were generated from the same engine.\n\nThe system shipped with an open toolkit so next year's committee can rebuild it without touching code.",
    category: "Design & Media", year: 2025, semester: "Spring", dept: "DME", supervisor: "Prof. Mina Verdier", program: "B.F.A. Communication Design",
    tags: ["webgl", "branding", "generative"], demoUrl: "https://hanroll.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dme/han-roll",
    views: 1024, techs: ["Blender", "TypeScript", "React"],
    members: [
      { name: "Ga Eul", role: "OWNER" }, { name: "Tomas Ri", role: "LEAD" }, { name: "Bin Na", role: "MEMBER" },
    ],
  },
  {
    title: "TypeFlow", summary: "An open kinetic-typography toolkit that turns lecture recordings into animated captions.",
    description: "TypeFlow takes a transcript plus audio and renders kinetic-typography videos that emphasize the rhythm of speech — designed for lecture highlights and campus media.\n\nThe editor is timeline-based with motion presets, and exports straight to social-ready vertical video.\n\nThe campus media center adopted it for the official recap series.",
    category: "Design & Media", year: 2024, semester: "Fall", dept: "DME", supervisor: "Prof. Mina Verdier", program: "B.F.A. Communication Design",
    tags: ["typography", "video", "editor"], demoUrl: "https://typeflow.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dme/typeflow",
    views: 731, techs: ["TypeScript", "React", "Figma"], looking: true,
    members: [
      { name: "Yu Jin", role: "OWNER" }, { name: "Oscar Han", role: "LEAD" },
      { name: "Sol Yi", role: "MEMBER" }, { name: "Rae Kim", role: "MEMBER" },
    ],
  },
  {
    title: "Campus Re:Frame", summary: "A crowdsourced photo archive preserving the campus as it was — building by building, decade by decade.",
    description: "Re:Frame invites students, alumni, and staff to submit photos tagged by building and year, then aligns them into a slider-based time machine.\n\nA moderation workflow keeps the archive respectful and rights-cleared, with donor consent captured at upload.\n\nThe archive launched with 2,300 photos dating back to 1968, contributed by 400+ people.",
    category: "Design & Media", year: 2023, semester: "Year-long", dept: "DME", supervisor: "Prof. Mina Verdier", program: "B.F.A. Photography",
    tags: ["archive", "photography"], demoUrl: "https://reframe.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dme/campus-reframe",
    views: 588, techs: ["Next.js", "PostgreSQL"],
    members: [
      { name: "Na Rae", role: "OWNER" }, { name: "Jun Seok", role: "LEAD" }, { name: "Hee Jin", role: "MEMBER" },
    ],
  },
  {
    title: "VentureTrack", summary: "A live portfolio simulator where student teams manage mock startup investments across a semester.",
    description: "VentureTrack gamifies early-stage investing: student teams get a mock fund, pitch decks from real campus startups, and a market that reprices weekly based on milestone events.\n\nThe pricing engine was calibrated on three years of campus demo-day outcomes.\n\nUsed as the core of the Venture Lab elective, with 96 teams enrolled in its first run.",
    category: "Data & Analytics", year: 2025, semester: "Fall", dept: "BUS", supervisor: "Prof. Adam Benali", program: "B.B.A. Finance",
    tags: ["simulation", "fintech", "education"], demoUrl: "https://venturetrack.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-bus/venturetrack",
    views: 812, techs: ["React", "Node.js", "MongoDB"],
    members: [
      { name: "Ha Neul", role: "OWNER" }, { name: "Dae Hyun", role: "LEAD" },
      { name: "Su Min", role: "MEMBER" }, { name: "Clara Jo", role: "MEMBER" },
    ],
  },
  {
    title: "CaféPulse", summary: "Demand forecasting for the five campus cafés that cut average queue time by a third.",
    description: "CaféPulse forecasts hourly demand per café from POS history, class schedules, weather, and events on the campus calendar.\n\nForecasts drive a simple staffing suggestion sheet that managers receive every morning, plus a public “best time to go” widget.\n\nOver six weeks, average queue time dropped from 9 to 6 minutes during the 12–1 PM peak.",
    category: "Data & Analytics", year: 2024, semester: "Spring", dept: "BUS", supervisor: "Prof. Adam Benali", program: "B.B.A. Business Analytics",
    tags: ["forecasting", "time-series"], views: 655, techs: ["Python", "PostgreSQL"], demoUrl: "https://cafepulse.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dsc/cafepulse",
    members: [
      { name: "Mi Sol", role: "OWNER" }, { name: "Tae Gyun", role: "MEMBER" },
    ],
  },
  {
    title: "TerraBot", summary: "A slope-mapping rover that surveys the hillside behind the engineering quad for erosion risk.",
    description: "TerraBot is a four-wheeled rover with articulated suspension that climbs the wooded slope behind the engineering quad and produces centimeter-grade elevation maps.\n\nAn onboard IMU-fused SLAM stack maps terrain while a moisture probe logs soil conditions — the combination flags erosion-prone zones for grounds keeping.\n\nThe chassis is fully 3D-printed and repairable with parts from the campus makerspace.",
    category: "IoT & Hardware", year: 2026, semester: "Year-long", dept: "MRE", supervisor: "Dr. Elena Petrova", program: "B.Eng. Mechatronics",
    tags: ["robotics", "slam", "3d-printing"], demoUrl: "https://terrabot.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-mre/terrabot",
    featured: true, views: 1770, techs: ["Raspberry Pi", "Python", "SolidWorks", "OpenCV"],
    members: [
      { name: "Gun Woo", role: "OWNER" }, { name: "Ha Eun", role: "LEAD" },
      { name: "Leon Kim", role: "MEMBER" }, { name: "Bo Ram", role: "MEMBER" }, { name: "Si Woo", role: "MEMBER" },
    ],
  },
  {
    title: "GripAssist", summary: "A soft robotic glove that supports hand rehabilitation exercises for stroke recovery patients.",
    description: "GripAssist is a lightweight fabric glove with tendon-driven soft actuators that assist finger flexion during rehab exercises.\n\nA pressure-sensitive grip tracker scores each repetition and streams session summaries to a therapist dashboard, so progress is measured instead of guessed.\n\nThe team ran a supervised pilot with the rehabilitation clinic at the affiliated hospital.",
    category: "IoT & Hardware", year: 2024, semester: "Fall", dept: "MRE", supervisor: "Dr. Elena Petrova", program: "B.Eng. Mechatronics",
    tags: ["soft-robotics", "healthcare"], demoUrl: "https://gripassist.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-mre/gripassist",
    views: 1102, techs: ["Arduino", "SolidWorks"],
    members: [
      { name: "Yeon Su", role: "OWNER" }, { name: "Ji Min", role: "LEAD" }, { name: "Pablo Seo", role: "MEMBER" },
    ],
  },
  {
    title: "DelayRadar", summary: "Shuttle delay prediction that tells you whether to walk or wait — before you get to the stop.",
    description: "DelayRadar fuses shuttle GPS traces, class schedule peaks, and weather into a per-stop delay forecast for the campus shuttle loop.\n\nA public dashboard and a lightweight widget show a confidence band for the next three departures at every stop.\n\nWaiting-time at the busiest stop fell 22% during the pilot month.",
    category: "Data & Analytics", year: 2025, semester: "Spring", dept: "DSC", supervisor: "Prof. Priya Nair", program: "B.S. Data Science",
    tags: ["prediction", "viz"], demoUrl: "https://delayradar.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dsc/delayradar",
    views: 934, techs: ["Python", "PostgreSQL", "React"],
    members: [
      { name: "Seung Min", role: "OWNER" }, { name: "Ae Ra", role: "LEAD" }, { name: "Nathan Ko", role: "MEMBER" },
    ],
  },
  {
    title: "MenuLens", summary: "Nutrition analytics for the dining halls — what's actually being eaten, and what's wasted.",
    description: "MenuLens combines tray-return photography with POS data to estimate what dishes get finished and what gets binned, per dining hall and per daypart.\n\nThe dashboard gives dining services a weekly menu-planning brief: which dishes to keep, shrink, or retire.\n\nPlate waste fell 14% in the two months after the first brief.",
    category: "Data & Analytics", year: 2024, semester: "Year-long", dept: "DSC", supervisor: "Prof. Priya Nair", program: "B.S. Data Science",
    tags: ["computer-vision", "sustainability", "dashboard"], views: 720, techs: ["Python", "OpenCV", "Docker"], demoUrl: "https://menulens.demo.ks.ac.kr", repoUrl: "https://github.com/kyungsung-dsc/menulens",
    members: [
      { name: "Cho Rin", role: "OWNER" }, { name: "Min Jae", role: "LEAD" },
      { name: "Hana Bae", role: "MEMBER" }, { name: "Leo Jung", role: "MEMBER" },
    ],
  },
];

const technologies = [
  { name: "React", category: "Frontend" }, { name: "Next.js", category: "Frontend" },
  { name: "TypeScript", category: "Frontend" }, { name: "Node.js", category: "Backend" },
  { name: "FastAPI", category: "Backend" }, { name: "PostgreSQL", category: "Data" },
  { name: "MongoDB", category: "Data" }, { name: "Python", category: "AI" },
  { name: "PyTorch", category: "AI" }, { name: "OpenCV", category: "AI" },
  { name: "Arduino", category: "Hardware" }, { name: "ESP32", category: "Hardware" },
  { name: "Raspberry Pi", category: "Hardware" }, { name: "LoRaWAN", category: "Hardware" },
  { name: "SolidWorks", category: "Hardware" }, { name: "Figma", category: "Design" },
  { name: "Blender", category: "Design" }, { name: "Docker", category: "DevOps" },
];

const programs = [
  "B.S. Computer Science", "B.Eng. Electrical Engineering", "B.F.A. Communication Design",
  "B.B.A. Business Analytics", "B.Eng. Mechatronics", "B.S. Data Science",
];

const deptProgram: Record<string, string> = {
  CSE: "B.S. Computer Science",
  ECE: "B.Eng. Electrical Engineering",
  DME: "B.F.A. Communication Design",
  BUS: "B.B.A. Business Analytics",
  MRE: "B.Eng. Mechatronics",
  DSC: "B.S. Data Science",
};

const bios = [
  "Builder of small useful things. Coffee-powered.",
  "Design-minded engineer. I like problems with edges and corners.",
  "Ask me about sensors, soldering, or the makerspace.",
  "Data person. I make charts people actually read.",
  "Second-year student exploring robotics and HCI.",
  "I ship on Fridays and regret nothing.",
];

async function main() {
  console.log("Resetting UniProjects data…");
  await db.notification.deleteMany();
  await db.report.deleteMany();
  await db.verification.deleteMany();
  await db.joinRequest.deleteMany();
  await db.follow.deleteMany();
  await db.bookmark.deleteMany();
  await db.like.deleteMany();
  await db.comment.deleteMany();
  await db.post.deleteMany();
  await db.projectTimeline.deleteMany();
  await db.projectResource.deleteMany();
  await db.projectTechnology.deleteMany();
  await db.technology.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.event.deleteMany();
  await db.department.deleteMany();

  // departments
  const deptMap = new Map<string, string>();
  for (const d of departments) {
    const created = await db.department.create({ data: d });
    deptMap.set(d.code, created.id);
  }
  console.log(`✓ ${departments.length} departments`);

  // technologies
  const techMap = new Map<string, string>();
  for (const t of technologies) {
    const created = await db.technology.create({
      data: { name: t.name, slug: slugify(t.name), category: t.category },
    });
    techMap.set(t.name, created.id);
  }
  console.log(`✓ ${technologies.length} technologies`);

  // faculty + admin
  const pwd = hashPassword("@Dhiren@123@");
  const faculty = [
    { username: "dana.kim", displayName: "Prof. Dana Kim", email: "dana.kim@ks.ac.kr", dept: "CSE", bio: "Associate professor. Human-computer interaction and accessibility. Supervisor of the SignBridge and GradAudit teams.", avatarUrl: "/avatars/av5.webp" },
    { username: "luis.marin", displayName: "Prof. Luis Marín", email: "luis.marin@ks.ac.kr", dept: "ECE", bio: "Embedded systems and renewable energy. I run the campus IoT lab on Fridays.", avatarUrl: "/avatars/av6.webp" },
    { username: "mina.verdier", displayName: "Prof. Mina Verdier", email: "mina.verdier@ks.ac.kr", dept: "DME", bio: "Motion design, generative identity systems, and typography that moves.", avatarUrl: "/avatars/av11.webp" },
    { username: "adam.benali", displayName: "Prof. Adam Benali", email: "adam.benali@ks.ac.kr", dept: "BUS", bio: "Venture lab lead. Former founder, now teaching the next ones.", avatarUrl: "/avatars/av12.webp" },
    { username: "elena.petrova", displayName: "Dr. Elena Petrova", email: "elena.petrova@ks.ac.kr", dept: "MRE", bio: "Field robotics and soft actuation. TerraBot's supervisor.", avatarUrl: "/avatars/av2.webp" },
    { username: "priya.nair", displayName: "Prof. Priya Nair", email: "priya.nair@ks.ac.kr", dept: "DSC", bio: "Applied statistics for campus operations. If it can be forecast, we will forecast it.", avatarUrl: "/avatars/av9.webp" },
    { username: "jiwoo.han", displayName: "Kathayat Dhirendra", email: "a2025991110@ks.ac.kr", dept: "CSE", bio: "Showcase curator & platform admin. Ping me about verification or reports.", role: "ADMIN", avatarUrl: "/avatars/av4.webp" },
  ];
  const userMap = new Map<string, string>();
  for (const f of faculty) {
    const u = await db.user.create({
      data: {
        username: f.username, displayName: f.displayName, email: f.email,
        passwordHash: pwd, role: f.role ?? "FACULTY", bio: f.bio, avatarUrl: f.avatarUrl ?? null,
        program: null, skills: "Mentoring,Research", departmentId: deptMap.get(f.dept),
        emailVerified: true, emailVerifiedAt: new Date(),
      },
    });
    userMap.set(f.displayName.replace(/^(Prof\.|Dr\.)\s*/, ""), u.id);
  }

  // students derived from project members
  const seen = new Map<string, { username: string; dept: string }>();
  let i = 0;
  for (const p of projects) {
    for (const m of p.members) {
      if (seen.has(m.name)) continue;
      const username = m.name.toLowerCase().replace(/[^a-z]+/g, ".");
      const u = await db.user.create({
        data: {
          username,
          displayName: m.name,
          email: `${username}@student.ks.ac.kr`,
          passwordHash: pwd,
          role: "STUDENT",
          bio: bios[i % bios.length],
          avatarUrl: `/avatars/av${(i % 10) + 1}.webp`,
          program: deptProgram[p.dept] ?? programs[i % programs.length],
          skills: p.techs.slice(0, 3).join(","),
          lookingForTeammates: i % 4 === 0,
          departmentId: deptMap.get(p.dept),
          emailVerified: true, emailVerifiedAt: new Date(),
        },
      });
      userMap.set(m.name, u.id);
      seen.set(m.name, { username, dept: p.dept });
      i++;
    }
  }
  console.log(`✓ ${userMap.size} users (7 staff + ${userMap.size - 7} students)`);

  // projects with memberships + techs + timeline + resources
  const slugMap = new Map<string, { id: string; dept: string; ownerId: string }>();
  let slugIndex = 0;
  for (const p of projects) {
    const ownerUser = userMap.get(p.members[0].name)!;
    const created = await db.project.create({
      data: {
        slug: slugify(p.title),
        title: p.title,
        summary: p.summary,
        description: p.description,
        coverImage: `/covers/${slugify(p.title)}.webp`,
        category: p.category,
        year: p.year,
        semester: p.semester,
        program: p.program,
        supervisor: p.supervisor,
        departmentId: deptMap.get(p.dept)!,
        ownerId: ownerUser,
        status: "PUBLISHED",
        lookingForTeammates: p.looking ?? false,
        tags: p.tags.join(","),
        demoUrl: p.demoUrl ?? null,
        repoUrl: p.repoUrl ?? null,
        featured: p.featured ?? false,
        views: p.views,
        members: { create: p.members.map((m) => ({ userId: userMap.get(m.name)!, role: m.role })) },
        technologies: { create: p.techs.map((t) => ({ technologyId: techMap.get(t)! })) },
      },
    });
    slugMap.set(created.slug, { id: created.id, dept: p.dept, ownerId: ownerUser });

    // every project ships its source code + demo + report as resources
    if (p.repoUrl || p.demoUrl) {
      await db.projectResource.createMany({
        data: [
          ...(p.repoUrl ? [{ projectId: created.id, type: "GITHUB", label: "Source code", url: p.repoUrl }] : []),
          ...(p.demoUrl ? [{ projectId: created.id, type: "DEMO", label: "Live demo", url: p.demoUrl }] : []),
          { projectId: created.id, type: "DOCUMENT", label: "Final report (PDF)", url: `https://reports.ks.ac.kr/showcase/${created.slug}.pdf` },
        ],
      });
    }

    // timeline: kickoff / milestone / demo for a few
    if (["campusnav-ar", "signbridge", "terrabot", "solarbench"].includes(created.slug)) {
      const y = p.year;
      await db.projectTimeline.createMany({
        data: [
          { projectId: created.id, title: "Kickoff & team formation", date: new Date(`${y - 1}-09-12`), note: "Team formed at the department project fair." },
          { projectId: created.id, title: "Midterm prototype review", date: new Date(`${y - 1}-12-05`), note: "First working prototype demoed to the supervisor." },
          { projectId: created.id, title: "Final demo day", date: new Date(`${y}-06-10`), note: "Presented at the department showcase." },
        ],
      });
    }

    // photo gallery: 2–3 shots per project, drawn deterministically from the pool
    const pool = ["/gallery/g1.webp", "/gallery/g2.webp", "/gallery/g3.webp", "/gallery/g4.webp", "/gallery/g5.webp", "/gallery/g6.webp"];
    const count = 2 + (slugIndex % 2); // alternate 2 / 3
    const picks = Array.from({ length: count }, (_, k) => pool[(slugIndex * 2 + k) % pool.length]);
    await db.projectImage.createMany({
      data: [...new Set(picks)].map((url, k) => ({ projectId: created.id, url, sortOrder: k })),
    });
    slugIndex++;
  }
  console.log(`✓ ${projects.length} projects`);

  // community posts
  const postSeeds = [
    { by: "Jisoo Park", body: "CampusNav AR just crossed 1,000 views on the showcase — thanks everyone who tested it during orientation week! AR markers refresh tonight, report anything weird. 🧭", tags: "" },
    { by: "Gun Woo", body: "TerraBot climbed the muddy slope after the rain and still mapped it at 3cm resolution. The new tread pattern works. Ask me anything about the chassis — files are in the makerspace folder.", tags: "" },
    { by: "Ga Eul", body: "Looking for one developer with WebGL experience for HAN-ROLL's spring festival build. It's a rolling physics logotype — weird in the best way. DM me or use the join button on the project page.", tags: "" },
    { by: "Priya Nair", body: "Reminder: verification requests for this semester's capstones close in two weeks. Approved projects get a verified badge and priority slots at demo day. Faculty, keep the queue clear!", tags: "" },
    { by: "Mi Sol", body: "CaféPulse update: the west café queue model now factors in exam-week patterns. Forecast error is down to 4 minutes. Shoutout to the DSC study group for the feature ideas.", tags: "" },
    { by: "Kevin Ha", body: "StudyMate is looking for a backend person who enjoys scheduling algorithms (said nobody ever — but seriously, it's fun). The project page has the full description.", tags: "" },
    { by: "Yeon Su", body: "GripAssist pilot session #12 done at the rehab clinic. Small win today: the grip sensor false-positive rate dropped below 2%. The therapists are finally smiling at us.", tags: "" },
  ];
  const postIds: string[] = [];
  for (const p of postSeeds) {
    const post = await db.post.create({
      data: { userId: userMap.get(p.by)!, body: p.body },
    });
    postIds.push(post.id);
  }
  // comments + likes on posts
  await db.comment.createMany({
    data: [
      { postId: postIds[0], userId: userMap.get("Minho Kang")!, body: "Congrats! The new library route is so much smoother now." },
      { postId: postIds[0], userId: userMap.get("Aera Choi")!, body: "Orientation feedback was overwhelmingly positive — well deserved." },
      { postId: postIds[2], userId: userMap.get("Tomas Ri")!, body: "Can confirm the physics logotype is extremely fun. Join them." },
      { postId: postIds[4], userId: userMap.get("Tae Gyun")!, body: "The exam-week feature saved my morning routine twice this week." },
    ],
  });
  await db.like.createMany({
    data: [
      { userId: userMap.get("Sora Lee")!, targetType: "POST", targetId: postIds[0] },
      { userId: userMap.get("Hyun Woo")!, targetType: "POST", targetId: postIds[0] },
      { userId: userMap.get("Chan Park")!, targetType: "POST", targetId: postIds[1] },
      { userId: userMap.get("Da In")!, targetType: "POST", targetId: postIds[1] },
      { userId: userMap.get("Marcus Oh")!, targetType: "POST", targetId: postIds[1] },
      { userId: userMap.get("Jisoo Park")!, targetType: "POST", targetId: postIds[2] },
      { userId: userMap.get("Kevin Ha")!, targetType: "POST", targetId: postIds[4] },
      { userId: userMap.get("Cho Rin")!, targetType: "POST", targetId: postIds[4] },
    ],
  });
  console.log(`✓ ${postSeeds.length} posts + comments + likes`);

  // project likes & follows & bookmarks
  const signbridge = slugMap.get("signbridge")!;
  const terrabot = slugMap.get("terrabot")!;
  await db.like.createMany({
    data: [
      { userId: userMap.get("Jisoo Park")!, targetType: "PROJECT", targetId: signbridge.id },
      { userId: userMap.get("Kevin Ha")!, targetType: "PROJECT", targetId: signbridge.id },
      { userId: userMap.get("Mi Sol")!, targetType: "PROJECT", targetId: terrabot.id },
    ],
  });
  await db.follow.createMany({
    data: [
      { followerId: userMap.get("Kevin Ha")!, targetType: "PROJECT", targetId: terrabot.id },
      { followerId: userMap.get("Aera Choi")!, targetType: "PROJECT", targetId: signbridge.id },
      { followerId: userMap.get("Yuna Ri")!, targetType: "USER", targetId: userMap.get("Sora Lee")! },
      { followerId: userMap.get("Minho Kang")!, targetType: "USER", targetId: userMap.get("Jisoo Park")! },
    ],
  });
  await db.bookmark.createMany({
    data: [
      { userId: userMap.get("Kevin Ha")!, targetType: "PROJECT", targetId: signbridge.id },
      { userId: userMap.get("Sora Lee")!, targetType: "PROJECT", targetId: terrabot.id },
    ],
  });

  // a pending join request + a pending verification + an open report
  await db.joinRequest.create({
    data: {
      projectId: terrabot.id,
      userId: userMap.get("Ji Hoon")!,
      message: "Hi! I worked on SoundCheck's firmware — I'd love to help with TerraBot's sensor logging.",
    },
  });
  await db.verification.create({
    data: { projectId: terrabot.id, requesterId: terrabot.ownerId },
  });
  await db.report.create({
    data: {
      reporterId: userMap.get("Cho Rin")!,
      targetType: "POST",
      targetId: postIds[5],
      reason: "Recruitment post — might belong in the projects board instead of the feed.",
    },
  });
  console.log("✓ join request, verification, report seeded");

  // notifications for the demo user (gun.woo owns TerraBot)
  await db.notification.createMany({
    data: [
      { userId: terrabot.ownerId, type: "JOIN_REQUEST", body: "Ji Hoon requested to join TerraBot.", link: "/project/terrabot" },
      { userId: terrabot.ownerId, type: "VERIFICATION", body: "Verification request for TerraBot is pending faculty review.", link: "/project/terrabot" },
      { userId: terrabot.ownerId, type: "FOLLOW", body: "Kevin Ha started following TerraBot.", link: "/project/terrabot" },
      { userId: userMap.get("Jisoo Park")!, type: "LIKE", body: "Sora Lee liked CampusNav AR.", link: "/project/campusnav-ar" },
      { userId: userMap.get("Jisoo Park")!, type: "COMMENT", body: "Minho Kang commented on your post.", link: "/community" },
    ],
  });

  // campus events
  await db.event.createMany({
    data: [
      { title: "Fall Demo Day 2026", description: "Forty teams, five departments, one auditorium. Watch this semester's capstones demo live and vote for the audience award.", location: "Engineering Hall, Daeyeon Campus", date: new Date("2026-12-04T13:00:00+09:00") },
      { title: "Makerspace Open Lab", description: "Monthly open lab — free filament, soldering help, and the laser cutter with a staff badge. Bring a project or find one.", location: "Makerspace, Central Library B1", date: new Date("2026-11-20T16:00:00+09:00") },
      { title: "Verification Clinic", description: "Drop-in session where faculty review verification requests and help teams tidy their showcase pages before demo day.", location: "CSE Common Lounge, Creative Hall", date: new Date("2026-11-12T14:00:00+09:00") },
    ],
  });
  console.log("✓ 3 events");

  console.log("\nDemo accounts: any seeded user · password: demo1234");
  console.log("e.g. jisoo.park (student), gun.woo (TerraBot owner), jiwoo.han (admin)");
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
