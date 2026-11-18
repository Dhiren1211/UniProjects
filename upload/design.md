# UniProject Design System

> **Visual reference:** [Flokka](https://flokka.me/)\
> **Purpose:** Visual design specification for UniProject --- colors,
> typography, layout, components, states, responsive behavior, and
> interaction style.

## 1. Design Direction

UniProject should borrow the **visual feeling** of Flokka rather than
copy its branding.

Flokka's current landing page uses a focused student-network message,
short sections, generous whitespace, strong typography, simple
navigation, and clear primary actions. Its content hierarchy moves from
a large statement → supporting explanation → feature/value blocks →
process → final CTA. citeturn1view0

### UniProject visual personality

-   **Modern academic**
-   **Friendly and student-first**
-   **Clean rather than corporate**
-   **Content-led**
-   **High whitespace**
-   **Strong typography**
-   **Soft surfaces and rounded components**
-   **One recognizable accent color**
-   **Minimal decorative noise**

The interface should feel like a combination of:

`University archive + student portfolio + community network`

not a traditional university administration portal.

------------------------------------------------------------------------

## 2. Brand Principles

### 2.1 Content is the hero

Projects, students, screenshots, technologies, and documentation are the
primary visual content.

Do not let UI decoration compete with project content.

### 2.2 One strong accent

Use one primary brand color consistently for:

-   Primary buttons
-   Active navigation
-   Links
-   Selected filters
-   Important badges
-   Focus states
-   Small visual accents

Avoid using many saturated colors at once.

### 2.3 Soft neutral canvas

The main page background should be a very light warm/cool neutral rather
than pure white.

Cards can remain white so that content feels elevated without heavy
shadows.

### 2.4 Typography creates hierarchy

Large headings should carry most of the visual identity. Body text
should remain quiet and highly readable.

### 2.5 Rounded, but not playful

Use medium-to-large corner radii for cards and controls.

Avoid excessive "bubble UI".

------------------------------------------------------------------------

# 3. Color System

## 3.1 Recommended UniProject palette

These values are the **UniProject implementation palette**, inspired by
the clean, restrained visual direction of Flokka rather than copied
brand colors.

  Token              HEX         Usage
  ------------------ ----------- ------------------------------
  `primary-500`      `#5B5CE2`   Main brand/accent
  `primary-600`      `#4D4ECF`   Hover/strong accent
  `primary-700`      `#3F40B8`   Active/pressed
  `primary-100`      `#E9E9FF`   Soft accent surface
  `primary-50`       `#F5F5FF`   Very light accent background
  `canvas`           `#F7F7F5`   Global page background
  `surface`          `#FFFFFF`   Cards, panels, inputs
  `surface-muted`    `#F1F1EF`   Secondary surfaces
  `text-primary`     `#17171C`   Headings/body emphasis
  `text-secondary`   `#5F6068`   Supporting text
  `text-tertiary`    `#8A8B93`   Metadata/captions
  `border`           `#E5E5E2`   Dividers/input borders
  `border-strong`    `#D2D2CE`   Hover/active borders
  `success`          `#16835B`   Success/verified
  `success-soft`     `#E7F6EF`   Success background
  `warning`          `#B7791F`   Warning
  `warning-soft`     `#FFF4D9`   Warning background
  `danger`           `#C44747`   Error/destructive
  `danger-soft`      `#FCEAEA`   Error background
  `info`             `#3978B8`   Informational
  `info-soft`        `#EAF3FC`   Informational background

### 3.2 Color ratio

Use approximately:

-   **70%** neutral canvas/surfaces
-   **25%** text/borders/secondary neutrals
-   **5%** primary accent and semantic colors

The accent should feel special. Do not turn the entire interface purple.

### 3.3 Dark mode

Dark mode is optional for v1.

If implemented:

``` text
background      #111116
surface         #19191F
surface-muted   #222229
text-primary    #F7F7F8
text-secondary  #B5B5BD
text-tertiary   #85858E
border          #303039
primary         #7778F0
```

------------------------------------------------------------------------

# 4. Typography

## 4.1 Font

### Primary

**Pretendard**

Recommended for UniProject because the product is expected to contain
Korean and English university content.

``` css
font-family:
  "Pretendard",
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

### Alternative

If Pretendard is unavailable:

``` text
Inter → Apple SD Gothic Neo → Segoe UI → sans-serif
```

## 4.2 Font weights

Use only four main weights:

  Weight   Purpose
  -------- -------------------------
  400      Body
  500      Labels/buttons
  600      Card titles/subheadings
  700      Major headings

Avoid using 800/900 except for a deliberate marketing hero.

## 4.3 Type scale

  Token          Size   Line height   Weight
  ------------ ------ ------------- --------
  Display        56px          1.05      700
  H1             44px           1.1      700
  H2             32px           1.2      700
  H3             24px          1.25      700
  H4             20px           1.3      600
  Body Large     18px           1.6      400
  Body           16px          1.55      400
  Body Small     14px           1.5      400
  Label          13px           1.4      500
  Caption        12px           1.4      400

### Heading rules

-   Keep headings short.
-   Prefer sentence case.
-   Avoid all-caps headings.
-   Use `letter-spacing: -0.02em` for large headings.
-   Do not use heavy shadows or gradients on text.

------------------------------------------------------------------------

# 5. Spacing System

Use a 4px base unit.

``` text
4   = 1xs
8   = 2xs
12  = xs
16  = sm
20  = md-sm
24  = md
32  = lg
40  = xl
48  = 2xl
64  = 3xl
80  = 4xl
96  = 5xl
128 = 6xl
```

### Common usage

-   Icon-to-label: `8px`
-   Input padding: `12–16px`
-   Card internal padding: `20–24px`
-   Section gap: `48–80px`
-   Major page sections: `80–120px`
-   Mobile page padding: `20px`
-   Desktop page padding: `32px`

------------------------------------------------------------------------

# 6. Layout

## 6.1 Main container

``` text
Maximum width: 1200px
Preferred width: calc(100% - 40px)
```

For large project galleries:

``` text
Maximum width: 1280px
```

For reading-heavy documentation:

``` text
Maximum width: 820px
```

## 6.2 Desktop grid

Default:

``` text
12-column grid
24px gutter
```

Example:

``` text
[ 3 ][ 6 ][ 3 ]
```

Profile/project detail:

``` text
[ 8 ][ 4 ]
```

Project gallery:

``` text
[ 4 ][ 4 ][ 4 ]
```

## 6.3 Mobile

Below `768px`:

-   Collapse multi-column layouts.
-   Use a single content column.
-   Reduce horizontal padding.
-   Keep primary CTA full-width where appropriate.
-   Convert filter bars into horizontal scroll or a filter sheet.

------------------------------------------------------------------------

# 7. Breakpoints

``` text
sm   640px
md   768px
lg   1024px
xl   1280px
2xl  1440px
```

Primary design targets:

-   Mobile: `360–639px`
-   Tablet: `640–1023px`
-   Desktop: `1024–1279px`
-   Wide desktop: `1280px+`

------------------------------------------------------------------------

# 8. Radius

  Token             Radius Usage
  --------------- -------- -------------------
  `radius-sm`          8px Small controls
  `radius-md`         12px Inputs/buttons
  `radius-lg`         16px Cards
  `radius-xl`         20px Featured cards
  `radius-2xl`        28px Hero/large panels
  `radius-full`      999px Pills/avatars

Default card radius: **16px**

Default button radius: **12px**

------------------------------------------------------------------------

# 9. Shadows

Keep shadows subtle.

### Card

``` css
box-shadow:
  0 1px 2px rgba(20, 20, 30, 0.04),
  0 8px 24px rgba(20, 20, 30, 0.05);
```

### Floating element

``` css
box-shadow:
  0 12px 32px rgba(20, 20, 30, 0.10);
```

Avoid large dark shadows.

Prefer borders + very soft shadows.

------------------------------------------------------------------------

# 10. Navigation

## Desktop

Recommended structure:

``` text
UniProject

Explore     Projects     Students     Community

                         Search   Log in   [Create Project]
```

### Behavior

-   Header height: `64–72px`
-   White or translucent surface
-   Thin bottom border
-   Sticky on desktop
-   Logo/wordmark remains left aligned
-   Primary CTA remains visually dominant

### Mobile

``` text
[Logo]                 [Search] [Menu]
```

Navigation opens as a full-height or large sheet.

------------------------------------------------------------------------

# 11. Buttons

## Primary

Use for the most important action.

Examples:

-   Create Project
-   Explore Projects
-   Join Community
-   Save Project

Style:

``` text
Background: primary-500
Text: white
Height: 44px
Padding: 0 18px
Radius: 12px
Weight: 600
```

## Secondary

``` text
Background: white
Border: 1px solid border
Text: text-primary
```

## Ghost

For low-priority navigation actions.

``` text
Background: transparent
Text: text-secondary
```

## Destructive

Use only for irreversible actions.

``` text
Background: danger
Text: white
```

### Button states

``` text
Default
Hover
Pressed
Focus
Disabled
Loading
```

Never communicate state using color alone.

------------------------------------------------------------------------

# 12. Inputs

Default:

``` text
Height: 44–48px
Radius: 12px
Border: 1px solid #E5E5E2
Background: #FFFFFF
```

Focus:

``` text
Border: primary-500
Box shadow: 0 0 0 3px primary-100
```

Search inputs should have a slightly larger radius:

``` text
Radius: 14px
```

------------------------------------------------------------------------

# 13. Cards

## General card

``` text
Background: surface
Border: 1px solid border
Radius: 16px
Padding: 20–24px
```

Hover:

``` text
border → border-strong
transform → translateY(-1px)
shadow → slightly stronger
```

Do not make cards jump dramatically on hover.

------------------------------------------------------------------------

# 14. Project Card

Project cards are one of the most important components in UniProject.

### Structure

``` text
┌─────────────────────────────────────┐
│ [Project image / screenshot]        │
│                                     │
├─────────────────────────────────────┤
│ Project Title                       │
│ Short project description...        │
│                                     │
│ [Web] [AI] [React]                  │
│                                     │
│ 👤 Creator Name · 2026              │
└─────────────────────────────────────┘
```

### Required visual information

Prioritize:

1.  Project thumbnail
2.  Project title
3.  Short description
4.  Technology/category tags
5.  Creator/team
6.  Year
7.  Optional status

### Do not overload the card

Do not show the entire documentation, repository URL, every technology,
or long descriptions on the card.

Those belong on the project detail page.

------------------------------------------------------------------------

# 15. Project Detail Page

Recommended layout:

``` text
Breadcrumb

Project Title
Short description

[Live Demo] [Source Code] [Documentation]

────────────────────────────────────

Project screenshots / gallery

────────────────────────────────────

About this project

Creators
[Student] [Student] [Student]

Technology
[React] [Node.js] [Python]

University
Department
Program
Category
Year / Semester

────────────────────────────────────

Related Projects
```

### Hero

The project title should be large but not excessively promotional.

The first screen should answer:

> What is this project?

> Who built it?

> What can I see/use?

------------------------------------------------------------------------

# 16. Student Profile

## Profile header

``` text
[Avatar]

Display Name
@username

University · Department · Program

Short bio

[Edit Profile] [Share]
```

Important rule:

**Display names are shown publicly. Usernames are identifiers.**

If a project tags a student:

``` text
Created by
John Kim
Sarah Lee
```

not:

``` text
@johnkim
@sarahlee
```

The username may still be available through profile navigation.

## Profile sections

``` text
Projects
Contributions
About
Skills
```

Projects tagged with the student should automatically appear in their
project section.

------------------------------------------------------------------------

# 17. Community Feed

The community should feel like a lightweight student network rather than
a social-media clone.

### Feed card

``` text
Avatar  Display Name
        Department · 2h

Post content...

[Project preview]

♡ 12     Comment 4     Share
```

### Recommended post types

-   Project announcement
-   Project update
-   Looking for teammates
-   Seeking feedback
-   Resource sharing
-   Event/hackathon
-   Question

Avoid introducing too many social mechanics in v1.

------------------------------------------------------------------------

# 18. Tags and Badges

### Technology tag

``` text
Background: #F1F1EF
Text: text-secondary
Radius: full
Height: 28px
Padding: 0 10px
```

### Category tag

Use primary-soft styling when the category is important.

### Verified badge

Use `success` only when verification is meaningful.

Do not use green decoration merely because something is a project.

------------------------------------------------------------------------

# 19. Filters

Project discovery should be filter-first.

Recommended filters:

``` text
University
Department
Program
Category
Year
Semester
Technology
Project Type
```

### Desktop

Use a horizontal filter row or left sidebar.

### Mobile

Use:

``` text
[Filter]
```

opening a bottom sheet.

### Active filters

Display removable chips:

``` text
Computer Science ×
2026 ×
AI ×
```

------------------------------------------------------------------------

# 20. Search

Global search should support:

-   Projects
-   Students
-   Universities
-   Departments
-   Technologies
-   Categories

Search results should visually separate result types.

Example:

``` text
PROJECT
Smart Campus Assistant

STUDENT
Kim Minseo

TECHNOLOGY
React
```

------------------------------------------------------------------------

# 21. Empty States

Empty states should be useful, not decorative.

Example:

``` text
No projects found

Try changing your filters or search terms.

[Clear filters]
```

For a new profile:

``` text
No projects yet

Projects you create or are tagged in will appear here.

[Explore Projects]
```

------------------------------------------------------------------------

# 22. Loading States

Prefer skeletons over generic spinners for content.

Project card skeleton:

``` text
████████████████████
████████████████████
████████

████████████
████████████████
████████
```

Use animation subtly.

------------------------------------------------------------------------

# 23. Error States

Example:

``` text
Something went wrong

We couldn't load this project.

[Try again]
```

Use red only for the actual error message/action.

------------------------------------------------------------------------

# 24. Interaction States

Every interactive component should define:

``` text
Default
Hover
Focus-visible
Pressed
Disabled
Loading
Selected
Error
```

### Focus

Use a visible focus ring:

``` css
outline: 3px solid rgba(91, 92, 226, 0.25);
outline-offset: 2px;
```

Never remove browser focus without replacing it.

------------------------------------------------------------------------

# 25. Icons

Recommended icon library:

**Lucide**

Use icons consistently at:

``` text
16px - compact UI
18px - buttons
20px - navigation
24px - major actions
```

Do not mix multiple icon styles.

Icons should support labels, not replace important text.

------------------------------------------------------------------------

# 26. Images

Project screenshots are content, not decoration.

### Project thumbnails

Preferred ratio:

``` text
16:10
```

### Profile avatars

``` text
1:1
```

### Gallery

Support:

``` text
16:10
4:3
1:1
```

Use `object-fit: cover` for cards.

Use `object-fit: contain` for screenshots where cropping would hide
important UI.

------------------------------------------------------------------------

# 27. Motion

Animation should feel calm and fast.

### Standard duration

``` text
Fast: 120ms
Normal: 180ms
Slow: 260ms
```

### Easing

``` text
ease-out
```

Use motion for:

-   Card hover
-   Menu opening
-   Filter transitions
-   Modal/sheet entry
-   Toasts
-   Page-level content appearance

Avoid:

-   Large bouncing animations
-   Continuous decorative animations
-   Excessive parallax
-   Slow page transitions

Respect:

``` css
@media (prefers-reduced-motion: reduce)
```

------------------------------------------------------------------------

# 28. Responsive Component Rules

## Project cards

Desktop:

``` text
3 columns
```

Tablet:

``` text
2 columns
```

Mobile:

``` text
1 column
```

## Project detail

Desktop:

``` text
8/4 split
```

Mobile:

``` text
1 column
```

## Profile

Desktop:

``` text
Profile header + tabs
```

Mobile:

``` text
Stacked profile
Scrollable tabs
```

## Community

Desktop:

``` text
Main feed + optional sidebar
```

Mobile:

``` text
Feed only
```

------------------------------------------------------------------------

# 29. Accessibility

Minimum requirements:

-   WCAG AA contrast target
-   Keyboard navigation
-   Visible focus states
-   Semantic HTML
-   Labels for all form inputs
-   Alt text for meaningful project images
-   Decorative images marked appropriately
-   Never use color as the only state indicator
-   Minimum touch target around `44 × 44px`

Text contrast should generally target at least **4.5:1 for normal text**
and **3:1 for large text/UI requirements**, consistent with common WCAG
AA guidance. citeturn0search1turn0search4

------------------------------------------------------------------------

# 30. Design Tokens

Recommended CSS variables:

``` css
:root {
  --color-primary: #5B5CE2;
  --color-primary-hover: #4D4ECF;
  --color-primary-active: #3F40B8;
  --color-primary-soft: #E9E9FF;

  --color-canvas: #F7F7F5;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F1EF;

  --color-text-primary: #17171C;
  --color-text-secondary: #5F6068;
  --color-text-tertiary: #8A8B93;

  --color-border: #E5E5E2;
  --color-border-strong: #D2D2CE;

  --color-success: #16835B;
  --color-warning: #B7791F;
  --color-danger: #C44747;
  --color-info: #3978B8;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 28px;
  --radius-full: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

------------------------------------------------------------------------

# 31. Tailwind Mapping

If Tailwind CSS is used, map the semantic tokens rather than hard-coding
colors throughout components.

Example:

``` js
colors: {
  primary: {
    50: "#F5F5FF",
    100: "#E9E9FF",
    500: "#5B5CE2",
    600: "#4D4ECF",
    700: "#3F40B8",
  },

  canvas: "#F7F7F5",
  surface: "#FFFFFF",

  ink: {
    900: "#17171C",
    700: "#5F6068",
    500: "#8A8B93",
  },

  border: "#E5E5E2",
}
```

------------------------------------------------------------------------

# 32. Page-Level Visual Rules

## Landing page

Follow the strongest part of the Flokka reference:

``` text
Large headline
Short explanation
Primary CTA
Supporting feature blocks
How-it-works section
Final CTA
```

For UniProject:

``` text
Discover what students build.

Explore university projects, discover student creators,
and find inspiration for your next project.

[Explore Projects] [Join UniProject]
```

Keep the hero visually quiet.

## Explore page

This should be the most functional page.

``` text
Page title
Search
Filters
Project grid
Pagination / infinite loading
```

## Project page

This should prioritize the work itself.

``` text
Project hero
Demo/source/documentation
Screenshots
Description
Creators
Metadata
Related projects
```

## Student profile

This should feel like a lightweight academic portfolio.

``` text
Identity
University context
Bio
Skills
Projects
Community activity
```

## Community

This should prioritize useful student interaction.

``` text
Create post
Feed
Categories
Project updates
Team requests
```

------------------------------------------------------------------------

# 33. Do / Don't

## Do

-   Use large whitespace.
-   Use strong typography.
-   Keep cards clean.
-   Use one primary accent.
-   Show project screenshots prominently.
-   Make creator identities visible.
-   Keep metadata compact.
-   Use subtle borders and shadows.
-   Make filtering easy.
-   Maintain consistent spacing.

## Don't

-   Do not copy Flokka's exact logo, branding, illustrations, or
    proprietary visual assets.
-   Do not use a rainbow palette.
-   Do not turn every card into a colorful gradient.
-   Do not use excessive shadows.
-   Do not put huge amounts of metadata on cards.
-   Do not make every page look like a social-media feed.
-   Do not use all-caps text everywhere.
-   Do not rely on hover as the only way to reveal information.
-   Do not sacrifice readability for visual effects.

------------------------------------------------------------------------

# 34. Final Visual Target

The final UniProject interface should feel:

> **Clean + academic + social + modern + trustworthy**

A useful mental model is:

``` text
Flokka's student-first simplicity
        +
modern portfolio presentation
        +
university archive structure
        +
light community interaction
```

The result should look like a product students would genuinely want to
use, while still being appropriate for a university project showcase.

------------------------------------------------------------------------

## Reference

-   Flokka --- student network: https://flokka.me/
-   WCAG / accessibility principles should be applied when implementing
    the final UI.
