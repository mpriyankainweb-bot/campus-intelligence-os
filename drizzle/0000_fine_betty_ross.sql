CREATE TYPE "public"."status" AS ENUM('pending', 'approved', 'rejected', 'executed');--> statement-breakpoint
CREATE TYPE "public"."persona" AS ENUM('student', 'faculty', 'principal');--> statement-breakpoint
CREATE TYPE "public"."standing" AS ENUM('good', 'probation', 'warning');--> statement-breakpoint
CREATE TABLE "academic_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"course" varchar(255) NOT NULL,
	"attendance_percent" numeric(5, 2) NOT NULL,
	"standing" "standing" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "career_opportunities" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"eligibility_criteria" jsonb NOT NULL,
	"deadline" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" varchar(255) NOT NULL,
	"messages" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"section" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"embedding" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"doc_type" varchar(100) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"status" "status" NOT NULL,
	"approver_id" integer,
	"action_data" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "long_term_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"fact" text NOT NULL,
	"context" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulated_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"action_data" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"fullName" text,
	"email" varchar(320),
	"persona" "persona" NOT NULL,
	"department" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
