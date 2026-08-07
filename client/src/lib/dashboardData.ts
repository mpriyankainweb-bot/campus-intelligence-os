/**
 * Demo datasets powering the dashboard sections. The server serves the same
 * values from the database when it's connected; these keep the UI rich in the
 * preview and act as the client-side fallback.
 */

export type Severity = "info" | "warning" | "critical" | "success";

// ---------------------------------------------------------------- Student ---

export const ATTENDANCE_TREND = [
  { week: "W1", attendance: 74 },
  { week: "W2", attendance: 78 },
  { week: "W3", attendance: 76 },
  { week: "W4", attendance: 81 },
  { week: "W5", attendance: 79 },
  { week: "W6", attendance: 84 },
  { week: "W7", attendance: 83 },
  { week: "W8", attendance: 86 },
];

export const TIMETABLE = [
  { day: "Monday", sessions: [
    { time: "09:00", course: "Data Structures", room: "A-204", instructor: "Dr. Rao" },
    { time: "11:00", course: "Computer Networks", room: "B-110", instructor: "Prof. Nair" },
    { time: "14:00", course: "OS Lab", room: "Lab-3", instructor: "Dr. Rao" },
  ]},
  { day: "Tuesday", sessions: [
    { time: "10:00", course: "Discrete Mathematics", room: "A-101", instructor: "Dr. Shah" },
    { time: "13:00", course: "Data Structures Lab", room: "Lab-1", instructor: "Dr. Rao" },
  ]},
  { day: "Wednesday", sessions: [
    { time: "09:00", course: "Operating Systems", room: "A-204", instructor: "Prof. Iyer" },
    { time: "11:00", course: "Computer Networks", room: "B-110", instructor: "Prof. Nair" },
    { time: "15:00", course: "Career Counseling", room: "CC-02", instructor: "Placement Cell" },
  ]},
  { day: "Thursday", sessions: [
    { time: "10:00", course: "Discrete Mathematics", room: "A-101", instructor: "Dr. Shah" },
    { time: "13:00", course: "Operating Systems Lab", room: "Lab-2", instructor: "Prof. Iyer" },
  ]},
  { day: "Friday", sessions: [
    { time: "09:00", course: "Data Structures", room: "A-204", instructor: "Dr. Rao" },
    { time: "11:00", course: "Computer Networks", room: "B-110", instructor: "Prof. Nair" },
    { time: "14:00", course: "Sports & Wellness", room: "Ground", instructor: "Coach Mehta" },
  ]},
];

export const PERFORMANCE = [
  { course: "Data Structures", score: 86, classAvg: 74 },
  { course: "OS", score: 78, classAvg: 71 },
  { course: "Discrete Math", score: 62, classAvg: 68 },
  { course: "Networks", score: 91, classAvg: 76 },
];

export const ASSIGNMENTS = [
  { id: 1, title: "Graph Algorithms Problem Set", course: "Data Structures", due: "Tomorrow, 11:59 PM", status: "pending", progress: 40 },
  { id: 2, title: "Process Scheduling Simulation", course: "Operating Systems", due: "In 3 days", status: "pending", progress: 15 },
  { id: 3, title: "Network Topology Report", course: "Computer Networks", due: "Submitted", status: "in-review", progress: 100 },
  { id: 4, title: "Set Theory Proofs", course: "Discrete Mathematics", due: "In 5 days", status: "pending", progress: 0 },
];

export const INTERNSHIP_RECOMMENDATIONS = [
  { id: 1, title: "Google SWE Internship", match: 92, why: "Matches your DS & Networks strength" },
  { id: 2, title: "Microsoft Research Fellowship", match: 84, why: "Strong academic record in core CS" },
  { id: 3, title: "Open Source Contributor Program", match: 88, why: "Open to probation students with sponsorship" },
];

export const PLACEMENT_OPPORTUNITIES = [
  { id: 1, title: "Google Software Engineering Internship", deadline: "45 days left", eligibility: "75%+ attendance, good standing", match: "high" },
  { id: 2, title: "Microsoft Research Summer Fellowship", deadline: "60 days left", eligibility: "CGPA 8.5+, good standing", match: "medium" },
  { id: 3, title: "Open Source Contributor Program", deadline: "30 days left", eligibility: "60%+ attendance, sponsor approval", match: "high" },
];

export const STUDENT_NOTIFICATIONS = [
  { id: 1, type: "success" as Severity, title: "Attendance milestone", body: "You crossed 85% in Computer Networks.", time: "2h ago", unread: true },
  { id: 2, type: "warning" as Severity, title: "Discrete Math alert", body: "Attendance at 62% — below 75% threshold.", time: "5h ago", unread: true },
  { id: 3, type: "info" as Severity, title: "New internship", body: "Microsoft Research Fellowship is now open.", time: "1d ago", unread: false },
  { id: 4, type: "info" as Severity, title: "Assignment graded", body: "Network Topology Report is under review.", time: "1d ago", unread: false },
];

// ---------------------------------------------------------------- Faculty ---

export const FACULTY_CLASSES = [
  { id: 1, code: "CS301", course: "Data Structures", students: 45, attendanceRate: 86, nextClass: "Today, 09:00", room: "A-204" },
  { id: 2, code: "CS305", course: "Operating Systems", students: 42, attendanceRate: 78, nextClass: "Tomorrow, 09:00", room: "A-204" },
  { id: 3, code: "CS310", course: "Advanced Algorithms", students: 38, attendanceRate: 91, nextClass: "Tomorrow, 14:00", room: "B-115" },
  { id: 4, code: "CS320", course: "Software Engineering", students: 40, attendanceRate: 82, nextClass: "Wed, 11:00", room: "A-102" },
];

export const FACULTY_ATTENDANCE = [
  { course: "CS301", rate: 86 },
  { course: "CS305", rate: 78 },
  { course: "CS310", rate: 91 },
  { course: "CS320", rate: 82 },
];

export const STUDENT_PERFORMANCE = [
  { id: 1, student: "Ananya Rao", attendance: 86, score: 88, status: "good" },
  { id: 2, student: "Rohan Verma", attendance: 64, score: 71, status: "warning" },
  { id: 3, student: "Sneha Pillai", attendance: 58, score: 62, status: "critical" },
  { id: 4, student: "Arjun Mehta", attendance: 92, score: 94, status: "good" },
  { id: 5, student: "Diya Kapoor", attendance: 77, score: 79, status: "good" },
];

export const ASSIGNMENT_REVIEWS = [
  { id: 1, title: "Graph Algorithms Problem Set", submissions: 38, graded: 22, status: "in-review" },
  { id: 2, title: "Network Topology Report", submissions: 45, graded: 45, status: "done" },
  { id: 3, title: "Process Scheduling Simulation", submissions: 0, graded: 0, status: "pending" },
];

export const LEAVE_REQUESTS = [
  { id: 1, teacher: "Dr. K. Nair", type: "Medical", from: "Aug 12", to: "Aug 14", status: "pending" },
  { id: 2, teacher: "Prof. S. Iyer", type: "Conference", from: "Aug 20", to: "Aug 22", status: "pending" },
  { id: 3, teacher: "Ms. P. Menon", type: "Personal", from: "Aug 25", to: "Aug 25", status: "approved" },
];

export const ANNOUNCEMENTS = [
  { id: 1, title: "Research Symposium 2026", body: "Abstract submissions open until Aug 20.", time: "2h ago", audience: "All" },
  { id: 2, title: "Lab Timings Update", body: "OS Lab will close at 8 PM during maintenance week.", time: "1d ago", audience: "Faculty" },
  { id: 3, title: "Placement Drive", body: "Google campus drive registration closes Friday.", time: "2d ago", audience: "Students" },
];

export const FACULTY_NOTIFICATIONS = [
  { id: 1, type: "warning" as Severity, title: "Intervention needed", body: "3 students in CS305 below 65% attendance.", time: "3h ago", unread: true },
  { id: 2, type: "info" as Severity, title: "Leave request", body: "Dr. K. Nair requested medical leave.", time: "5h ago", unread: true },
  { id: 3, type: "success" as Severity, title: "Assignment graded", body: "Network Topology Report fully reviewed.", time: "1d ago", unread: false },
];

// -------------------------------------------------------------- Principal ---

export const DEPT_ATTENDANCE = [
  { department: "CSE", attendance: 84, students: 320 },
  { department: "ECE", attendance: 79, students: 280 },
  { department: "ME", attendance: 74, students: 260 },
  { department: "CE", attendance: 81, students: 240 },
  { department: "MBA", attendance: 88, students: 180 },
];

export const PLACEMENT_STATS = [
  { year: "2023", placed: 62, students: 100 },
  { year: "2024", placed: 71, students: 100 },
  { year: "2025", placed: 78, students: 100 },
  { year: "2026", placed: 84, students: 100 },
];

export const INTERNSHIP_STATS = [
  { type: "On-campus", count: 210 },
  { type: "Off-campus", count: 140 },
  { type: "Remote", count: 95 },
  { type: "Research", count: 60 },
];

export const FACULTY_PERFORMANCE = [
  { id: 1, faculty: "Dr. A. Rao", dept: "CSE", courses: 4, rating: 4.8 },
  { id: 2, faculty: "Dr. V. Shah", dept: "CSE", courses: 3, rating: 4.6 },
  { id: 3, faculty: "Prof. M. Nair", dept: "ECE", courses: 3, rating: 4.2 },
  { id: 4, faculty: "Dr. K. Krishnan", dept: "ME", courses: 4, rating: 4.4 },
];

export const STUDENT_INSIGHTS = [
  { id: 1, title: "Probation cohort rising", body: "12% of second-year students below attendance threshold — intervention plans recommended.", severity: "warning" as Severity },
  { id: 2, title: "Top performer", body: "Diya Kapoor leads the 2026 cohort with a 94% academic average.", severity: "success" as Severity },
  { id: 3, title: "Dropping trend", body: "ECE attendance slipped 4% this month across two core courses.", severity: "critical" as Severity },
];

export const AI_RECOMMENDATIONS = [
  { id: 1, title: "Attendance intervention program", body: "Target 12 departments with automated alerts at 70% attendance to preempt probation spikes.", impact: "High" },
  { id: 2, title: "Expand remote internships", body: "Remote internship placements grew 38% YoY — negotiate 15 more corporate remote roles.", impact: "High" },
  { id: 3, title: "Faculty load rebalancing", body: "CS301/CS305 sections above capacity; rebalance 2 sections to equalize student load.", impact: "Medium" },
  { id: 4, title: "Placement prep early start", body: "Students starting prep in year 2 place 22% more often; open the careers portal to sophomores.", impact: "Medium" },
];

export const ALERTS = [
  { id: 1, severity: "critical" as Severity, title: "Attendance crisis — ECE", body: "ECE third-year attendance below 70% for 2 consecutive weeks.", time: "1h ago" },
  { id: 2, severity: "warning" as Severity, title: "Pending approvals", body: "3 high-impact actions await your decision.", time: "4h ago" },
  { id: 3, severity: "info" as Severity, title: "Placement drive", body: "Google campus drive registrations close Friday.", time: "1d ago" },
  { id: 4, severity: "success" as Severity, title: "Research grant", body: "Applied AI lab secured ₹40L research funding.", time: "2d ago" },
];

export const PRINCIPAL_NOTIFICATIONS = [
  { id: 1, type: "critical" as Severity, title: "ECE attendance alert", body: "Third-year ECE below 70% for 2 weeks.", time: "1h ago", unread: true },
  { id: 2, type: "warning" as Severity, title: "Approvals queue", body: "3 high-impact actions pending.", time: "4h ago", unread: true },
  { id: 3, type: "success" as Severity, title: "Grant approved", body: "Applied AI lab research grant confirmed.", time: "1d ago", unread: false },
];
