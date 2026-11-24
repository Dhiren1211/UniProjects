import { PrismaClient } from "@prisma/client";
import { hashPassword, generateTemporaryPassword } from "../src/lib/auth";
import { departmentRows } from "./ks-departments";

/**
 * Production seed - wipes ALL data and creates only what the platform needs to boot:
 *   - the official Kyungsung department catalogue
 *   - the technology tag catalogue
 *   - default site settings
 *   - one ADMIN account (everyone else is provisioned through account requests)
 *
 * Admin details come from the environment:
 *   ADMIN_USERNAME  (default "dhirendra.kathayat")
 *   ADMIN_NAME      (default "Dhirendra Kathayat")
 *   ADMIN_EMAIL     (default "<username>@ks.ac.kr")
 *   ADMIN_PASSWORD  (optional - a strong random password is generated and printed once if unset)
 */

const db = new PrismaClient();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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
  await db.projectTimeline.deleteMany();
  await db.projectResource.deleteMany();
  await db.projectImage.deleteMany();
  await db.projectTechnology.deleteMany();
  await db.technology.deleteMany();
  await db.projectMember.deleteMany();
  await db.project.deleteMany();
  await db.passwordResetRequest.deleteMany();
  await db.accountRequest.deleteMany();
  await db.announcement.deleteMany();
  await db.emailLog.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();
  await db.department.deleteMany();

  // departments
  await db.department.createMany({ data: departmentRows });
  console.log(`✓ ${departmentRows.length} departments`);

  // technologies
  await db.technology.createMany({
    data: technologies.map((t) => ({ name: t.name, slug: slugify(t.name), category: t.category })),
  });
  console.log(`✓ ${technologies.length} technologies`);

  // site settings (admin-editable defaults)
  await db.setting.createMany({
    data: [
      { key: "searchEnabled", value: "true" },
      { key: "accountRequestsOpen", value: "true" },
      { key: "siteName", value: "UniProjects" },
      { key: "heroTitle", value: "Capstone Contest..." },
      {
        key: "heroSubtitle",
        value:
          "Student teams turn a year of capstone design work into published, searchable projects - supervised, verified and open to everyone.",
      },
      { key: "heroImage", value: "/hero/campus.jpg" },
    ],
  });
  console.log("✓ site settings");

  // the single bootstrap admin
  const username = process.env.ADMIN_USERNAME?.trim() || "dhirendra.kathayat";
  const displayName = process.env.ADMIN_NAME?.trim() || "Dhirendra Kathayat";
  const email = process.env.ADMIN_EMAIL?.trim() || `${username}@ks.ac.kr`;
  const supplied = process.env.ADMIN_PASSWORD;
  const password = supplied || generateTemporaryPassword(20);
  await db.user.create({
    data: {
      username, displayName, email,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      emailVerified: true, emailVerifiedAt: new Date(),
    },
  });
  console.log(`✓ admin account "${username}" (${email})`);
  if (!supplied) {
    console.log(`\n  Generated admin password (shown once - store it safely): ${password}\n`);
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
