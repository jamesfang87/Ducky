# Ducky — An AI-Powered Learning Management System

**A learning management system that helps students build understanding and helps teachers measure it.**

**Live demo:** https://ducky-snowy.vercel.app/  
**Source code:** https://github.com/jamesfang87/HackTX-2026

## Overview

Ducky is an AI-powered learning management system (LMS) that combines class management, guided problem-solving, and student assessment.

Teachers create classes, set assignment rules, and track student progress. Students work through problems with Ducky, a talking duck AI tutor. Ducky asks questions, checks reasoning, and helps students correct misconceptions instead of giving them answers.

The system also gives teachers evidence of student understanding through transcripts, rubric scores, and a class-wide misconception heatmap.

## The Problem

Students in large classes often cannot get individual help. General-purpose AI tools can give answers without teaching the reasoning behind them.

Teachers also need to know where students struggle. Assignment scores alone do not always show why a student makes an error. Public answer sites can make it harder to measure what students understand.

## The Solution

Ducky brings learning activities, AI tutoring, and teacher insights into one platform.

Students explain their reasoning by voice, text, or sketch. Ducky asks follow-up questions and tracks their progress. Teachers control how students use AI and review the reasoning behind their work.

## Core LMS Features

### Class and Assignment Management

- **Class setup:** Teachers create classes and share a join code or QR code.
- **Assignment policies:** Teachers set hint limits, answer-reveal rules, voice requirements, and permitted tools.
- **Student sessions:** Students open assigned problems and work through them in a guided learning session.
- **Controlled answer access:** The server enforces the hint limit and answer-reveal policy. An answer reveal can be enabled for no credit.

### AI-Powered Learning

- **Guided problem-solving:** Ducky asks students to explain each step instead of giving direct answers.
- **Misconception tracking:** Ducky identifies errors and tracks progress as students correct them.
- **Interactive visuals:** Ducky generates step-by-step visuals, such as a free-fall simulation. A second AI model reviews each visual before the student sees it.
- **Learning safeguards:** Server-side checks enforce assignment rules and help block attempts to bypass the tutor's instructions.

### Teacher Dashboard and Assessment

- **Class misconception heatmap:** Teachers can see common errors across the class.
- **Student transcripts:** Teachers can review each student's reasoning and responses.
- **Rubric-based scoring:** The system provides live rubric scores for student sessions. Teachers can override these scores.
- **Leak Radar:** SerpApi searches for assigned problems on answer sites. This helps teachers identify problems that may already have public solutions.

## What Makes Ducky Different?

Traditional learning management systems organize courses, assignments, and grades. Ducky adds a guided learning process and insight into student reasoning.

The platform combines:

1. Class and assignment management.
2. AI tutoring that guides students instead of giving answers.
3. Misconception tracking and interactive learning visuals.
4. Rubric-based assessment and class-wide learning insights.
5. Teacher controls for AI use and answer access.

Ducky helps teachers move beyond checking whether students have the right answer. It helps them examine how students reached that answer.

## Live Demo

The demo uses a physics problem about falling objects.

1. A student claims that a heavier object hits the ground first.
2. Ducky identifies the misconception, asks a follow-up question, and opens a free-fall visual.
3. The student explains why the masses cancel in \(F = ma\).
4. Ducky records the self-correction in the student's reasoning path.
5. The teacher dashboard shows the session transcript, rubric score, misconception data, and leak alert.

This workflow demonstrates the student learning experience and the teacher's view of student progress.

## Technical Implementation

- **Application:** Next.js 15, React 19, TypeScript, and Tailwind CSS.
- **Authentication and database:** Supabase, Google sign-in, PostgreSQL, and row-level security.
- **AI tutor:** Meta Muse Spark, with an optional OpenAI-compatible fallback.
- **Voice:** Browser speech input and a server-side transcription route.
- **Learning visuals:** Model-generated SVG animations with a server-side review process.
- **Problem search:** SerpApi for Leak Radar.
- **Deployment:** Vercel.

The main application includes API routes for tutoring, hints, answer reveals, visual generation, and transcription. The server checks session access and applies assignment rules. The session API does not send the solution to the student.

## Project Links

- **Live demo:** https://ducky-snowy.vercel.app/
- **GitHub repository:** https://github.com/jamesfang87/HackTX-2026
- **Main application and demo script:** https://github.com/jamesfang87/HackTX-2026/blob/main/ducky/README.md
- **Product requirements:** https://github.com/jamesfang87/HackTX-2026/blob/main/PRD.md
