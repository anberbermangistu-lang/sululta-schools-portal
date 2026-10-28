import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                index: resolve(import.meta.dirname, "index.html"),
                login: resolve(import.meta.dirname, "login.html"),
                forgotPassword: resolve(import.meta.dirname, "forgot-password.html"),
                resetPassword: resolve(import.meta.dirname, "reset-password.html"),

                adminDashboard: resolve(import.meta.dirname, "admin/dashboard.html"),
                adminTeacherAssignments: resolve(import.meta.dirname, "admin/teacher-assignments.html"),
                adminUserAdd: resolve(import.meta.dirname, "admin/user-add.html"),
                adminUserEdit: resolve(import.meta.dirname, "admin/user-edit.html"),
                adminUserView: resolve(import.meta.dirname, "admin/user-view.html"),
                adminUsers: resolve(import.meta.dirname, "admin/users.html"),

                attendanceAdd: resolve(import.meta.dirname, "attendance/add.html"),
                attendanceDashboard: resolve(import.meta.dirname, "attendance/dashboard.html"),
                attendanceDelete: resolve(import.meta.dirname, "attendance/delete.html"),
                attendanceEdit: resolve(import.meta.dirname, "attendance/edit.html"),
                attendanceView: resolve(import.meta.dirname, "attendance/view.html"),

                classesAdd: resolve(import.meta.dirname, "classes/add.html"),
                classesDashboard: resolve(import.meta.dirname, "classes/dashboard.html"),
                classesEdit: resolve(import.meta.dirname, "classes/edit.html"),
                classesView: resolve(import.meta.dirname, "classes/view.html"),

                eventsAdd: resolve(import.meta.dirname, "events/add.html"),
                eventsDashboard: resolve(import.meta.dirname, "events/dashboard.html"),
                eventsDelete: resolve(import.meta.dirname, "events/delete.html"),
                eventsEdit: resolve(import.meta.dirname, "events/edit.html"),
                eventsView: resolve(import.meta.dirname, "events/view.html"),

                examsAdd: resolve(import.meta.dirname, "exams/add.html"),
                examsDashboard: resolve(import.meta.dirname, "exams/dashboard.html"),
                examsDelete: resolve(import.meta.dirname, "exams/delete.html"),
                examsEdit: resolve(import.meta.dirname, "exams/edit.html"),
                examsView: resolve(import.meta.dirname, "exams/view.html"),

                feesAdd: resolve(import.meta.dirname, "fees/add.html"),
                feesDashboard: resolve(import.meta.dirname, "fees/dashboard.html"),
                feesDelete: resolve(import.meta.dirname, "fees/delete.html"),
                feesEdit: resolve(import.meta.dirname, "fees/edit.html"),
                feesView: resolve(import.meta.dirname, "fees/view.html"),

                libraryAdd: resolve(import.meta.dirname, "library/add.html"),
                libraryDashboard: resolve(import.meta.dirname, "library/dashboard.html"),
                libraryDelete: resolve(import.meta.dirname, "library/delete.html"),
                libraryEdit: resolve(import.meta.dirname, "library/edit.html"),

                noticesAdd: resolve(import.meta.dirname, "notices/add.html"),
                noticesDashboard: resolve(import.meta.dirname, "notices/dashboard.html"),
                noticesDelete: resolve(import.meta.dirname, "notices/delete.html"),
                noticesEdit: resolve(import.meta.dirname, "notices/edit.html"),
                noticesView: resolve(import.meta.dirname, "notices/view.html"),

                parentAttendance: resolve(import.meta.dirname, "parent/attendance.html"),
                parentChild: resolve(import.meta.dirname, "parent/child.html"),
                parentDashboard: resolve(import.meta.dirname, "parent/dashboard.html"),
                parentNotices: resolve(import.meta.dirname, "parent/notices.html"),
                parentPassword: resolve(import.meta.dirname, "parent/password.html"),
                parentProfile: resolve(import.meta.dirname, "parent/profile.html"),

                parentsAdd: resolve(import.meta.dirname, "parents/add.html"),
                parentsDashboard: resolve(import.meta.dirname, "parents/dashboard.html"),
                parentsEdit: resolve(import.meta.dirname, "parents/edit.html"),
                parentsView: resolve(import.meta.dirname, "parents/view.html"),

                resultsAdd: resolve(import.meta.dirname, "results/add.html"),
                resultsDashboard: resolve(import.meta.dirname, "results/dashboard.html"),
                resultsDelete: resolve(import.meta.dirname, "results/delete.html"),
                resultsEdit: resolve(import.meta.dirname, "results/edit.html"),
                resultsView: resolve(import.meta.dirname, "results/view.html"),

                studentAttendance: resolve(import.meta.dirname, "student/attendance.html"),
                studentBooks: resolve(import.meta.dirname, "student/books.html"),
                studentDashboard: resolve(import.meta.dirname, "student/dashboard.html"),
                studentEvents: resolve(import.meta.dirname, "student/events.html"),
                studentFees: resolve(import.meta.dirname, "student/fees.html"),
                studentHistory: resolve(import.meta.dirname, "student/history.html"),
                studentNotices: resolve(import.meta.dirname, "student/notices.html"),
                studentPassword: resolve(import.meta.dirname, "student/password.html"),
                studentProfile: resolve(import.meta.dirname, "student/profile.html"),
                studentResults: resolve(import.meta.dirname, "student/results.html"),
                studentSubjects: resolve(import.meta.dirname, "student/subjects.html"),
                studentTimetable: resolve(import.meta.dirname, "student/timetable.html"),

                studentsAdd: resolve(import.meta.dirname, "students/add.html"),
                studentsDashboard: resolve(import.meta.dirname, "students/dashboard.html"),
                studentsDelete: resolve(import.meta.dirname, "students/delete.html"),
                studentsEdit: resolve(import.meta.dirname, "students/edit.html"),
                studentsView: resolve(import.meta.dirname, "students/view.html"),

                subjectsAdd: resolve(import.meta.dirname, "subjects/add.html"),
                subjectsDashboard: resolve(import.meta.dirname, "subjects/dashboard.html"),
                subjectsDelete: resolve(import.meta.dirname, "subjects/delete.html"),
                subjectsEdit: resolve(import.meta.dirname, "subjects/edit.html"),
                subjectsView: resolve(import.meta.dirname, "subjects/view.html"),

                teacherAttendance: resolve(import.meta.dirname, "teacher/attendance.html"),
                teacherClasses: resolve(import.meta.dirname, "teacher/classes.html"),
                teacherDashboard: resolve(import.meta.dirname, "teacher/dashboard.html"),
                teacherPassword: resolve(import.meta.dirname, "teacher/password.html"),
                teacherProfile: resolve(import.meta.dirname, "teacher/profile.html"),
                teacherResults: resolve(import.meta.dirname, "teacher/results.html"),
                teacherStudents: resolve(import.meta.dirname, "teacher/students.html"),
                teacherTimetable: resolve(import.meta.dirname, "teacher/timetable.html"),

                teachersAdd: resolve(import.meta.dirname, "teachers/add.html"),
                teachersDashboard: resolve(import.meta.dirname, "teachers/dashboard.html"),
                teachersDelete: resolve(import.meta.dirname, "teachers/delete.html"),
                teachersEdit: resolve(import.meta.dirname, "teachers/edit.html"),
                teachersView: resolve(import.meta.dirname, "teachers/view.html"),

                timetableAdd: resolve(import.meta.dirname, "timetable/add.html"),
                timetableDashboard: resolve(import.meta.dirname, "timetable/dashboard.html"),
                timetableDelete: resolve(import.meta.dirname, "timetable/delete.html"),
                timetableEdit: resolve(import.meta.dirname, "timetable/edit.html"),
                timetableView: resolve(import.meta.dirname, "timetable/view.html")
            }
        }
    }
});
