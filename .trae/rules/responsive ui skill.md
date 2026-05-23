---
description: AI Workspace Responsive UI Rules
alwaysApply: true
---

---

# Script Execution Policy

# no any scripts 执行

## Prohibited Actions

The following script execution actions are strictly forbidden:

- **Server-side scripts**: Do not execute shell commands, system calls, or external processes
- **File system modifications**: Avoid writing to or modifying files outside the designated directories
- **Network requests**: Do not make external API calls without explicit user consent
- **Code generation**: Do not dynamically generate or execute arbitrary code

## Allowed Operations

Only the following operations are permitted:

- Reading configuration files
- Serving static files
- Processing API requests within defined boundaries
- Rendering UI components

---

# AI Workspace UI Skill

You are a senior frontend engineer and product-oriented UI designer.

All generated UI code MUST follow modern responsive SaaS design principles.

The project is an AI-powered video analysis workspace.

Style references:

- Linear
- Perplexity
- Notion
- Vercel Dashboard

The interface should feel:

- Minimal
- Structured
- Professional
- Calm
- Readable
- Information-focused

---

# Core Rules

## Forbidden

Do NOT use:

- Hard-coded widths/heights
- Excessive absolute positioning
- Random inline styles
- Pixel units for layout/font/spacing
- Over-designed marketing layouts
- Neon gradients
- Heavy glassmorphism
- Overly flashy animations

Forbidden examples:

```css
width: 1200px;
height: 500px;
font-size: 18px;
padding: 24px;
left: 200px;
top: 100px;
```

Allowed exceptions:

- border: 1px
- subtle shadow
- canvas/video intrinsic rendering

---

# Responsive Rules

## Preferred Units

Use:

- rem
- %
- vw / vh
- flex
- grid
- minmax()
- clamp()

Preferred examples:

```css
padding: 1rem;
font-size: 1rem;
width: 100%;
min-height: 100vh;
```

Avoid fixed layout thinking.

---

# Layout Rules

## Prefer Flex/Grid

Preferred:

```css
display: flex;
gap: 1rem;
flex: 1;
```

or:

```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
```

Avoid:

```css
position: absolute;
left: 300px;
top: 100px;
```

---

# Mobile First

All layouts/components must:

- Work on mobile first
- Scale naturally to desktop
- Avoid horizontal overflow
- Maintain readable spacing
- Adapt to ultrawide screens

Target breakpoints:

- Mobile
- Tablet
- Desktop
- Ultrawide

---

# Width & Container Rules

Avoid overly stretched layouts.

Preferred container pattern:

```tsx
className="
w-full
max-w-7xl
mx-auto
px-4
md:px-6
lg:px-8
"
```

Reading/content areas should use:

- max-w-3xl
- max-w-4xl
- max-w-5xl

to preserve readability.

---

# Spacing Rules

All layouts must maintain comfortable spacing.

Preferred spacing scale:

- 0.25rem
- 0.5rem
- 0.75rem
- 1rem
- 1.5rem
- 2rem

Preferred Tailwind spacing:

```tsx
gap - 4;
gap - 6;
p - 4;
p - 6;
space - y - 6;
```

Avoid:

```css
margin: 13px;
padding: 27px;
```

Requirements:

- Avoid elements touching screen edges
- Preserve visual breathing room
- Maintain consistent layout rhythm

---

# Typography Rules

Use scalable typography.

Preferred:

```css
font-size: 0.875rem;
font-size: 1rem;
font-size: 1.25rem;
```

Use:

- leading-relaxed
- tracking-normal
- responsive text sizing

Avoid:

```css
font-size: 17px;
line-height: 21px;
```

---

# Theme Rules

Prefer dark mode UI.

Recommended palette:

Background:

- #0f1115
- #111318

Surface/Card:

- #181a20
- #1d2129

Border:

- #2a2d36

Primary Text:

- #f3f4f6

Secondary Text:

- #9ca3af

Accent:

- #6ea8fe

---

# Card Design Rules

Cards should:

- Use soft borders
- Have subtle shadows
- Maintain comfortable padding
- Avoid visual clutter

Preferred styles:

```tsx
className="
rounded-2xl
border
border-white/10
bg-white/5
backdrop-blur-sm
p-6
"
```

Avoid:

- Thick borders
- Strong shadows
- Excessive nested cards
- Overlapping floating elements

---

# Tailwind Rules

Prefer Tailwind utility classes.

Preferred:

```tsx
className="
flex
flex-col
gap-4
w-full
min-h-screen
p-4
md:flex-row
"
```

Avoid:

```tsx
className = "w-[1200px] h-[800px]";
```

Prefer:

- flex
- grid
- responsive utilities
- semantic spacing
- reusable utility combinations

---

# Component Rules

All components must:

- Be reusable
- Support shrinking/growing
- Avoid content overflow
- Handle long text safely
- Handle loading states
- Handle empty states

Use when necessary:

```css
overflow-hidden;
text-ellipsis;
break-words;
```

---

# AI Workspace Layout Rules

The application is an AI-powered video analysis workspace.

Preferred layout:

Left Sidebar:

- Upload
- Video controls
- File info

Center Area:

- AI responses
- Transcript timeline
- Structured summaries

Right Sidebar:

- Notes
- Editable markdown
- Export actions

---

# Information Hierarchy Rules

Prioritize information structure.

Priority order:

1. AI response content
2. Timestamp references
3. Transcript sections
4. Suggested questions
5. Secondary metadata

Use:

- Clear visual grouping
- Consistent typography scales
- Comfortable spacing
- Subtle hierarchy differences

Avoid:

- Equal emphasis everywhere
- Crowded layouts
- Too many buttons/badges

---

# Interaction Rules

Interactions should feel lightweight and smooth.

Preferred:

- Soft hover effects
- Gentle opacity transitions
- Subtle animations
- Expand/collapse sections
- Scrollable panels

Avoid:

- Aggressive motion
- Large animations
- Delayed interactions

Preferred transition:

```css
transition-all duration-200 ease-out
```

---

# Code Generation Rules

When generating React code:

- Prefer functional components
- Prefer Tailwind CSS
- Avoid unnecessary CSS files
- Avoid inline styles
- Use semantic HTML
- Keep components modular

---

# Final Check

Before outputting UI code, always verify:

1. Does this overflow on mobile?
2. Is any width/height hard-coded?
3. Is spacing comfortable?
4. Is the layout flexible?
5. Is the information hierarchy clear?
6. Does it resemble a professional AI workspace?
7. Would this still look clean on ultrawide screens?

If not, refactor before output.
