\# Sululta Secondary School Management Portal



A web-based school management system developed for Sululta Secondary School to manage academic, administrative, and school-related activities through a centralized platform.



\## Overview



The Sululta Secondary School Management Portal provides a centralized system for managing school information and activities. It supports different user roles and provides role-specific dashboards and functionality.



The system was developed as a Web Programming project and demonstrates frontend development, database management, authentication, CRUD operations, responsive UI design, and web deployment.



\## Live Application



\*\*Production:\*\* https://sululta-school-portal.vercel.app/



\## Source Code



\*\*GitHub Repository:\*\* https://github.com/adisuurge4-cloud/sululta-school-portal



\## User Roles



The system supports four main user roles:



| Role          | Description                                                 |

| ------------- | ----------------------------------------------------------- |

| Administrator | Manages the overall school system and user accounts         |

| Teacher       | Manages teaching-related activities and student information |

| Student       | Accesses personal and academic information                  |

| Parent        | Accesses information related to their child                 |



After authentication, users are redirected to the dashboard appropriate to their assigned role.



\## Main Features



\### Administrator



\* Dashboard statistics

\* Student management

\* Teacher management

\* Parent management

\* Class management

\* Subject management

\* Attendance management

\* Examination management

\* Results management

\* Fees management

\* Notice management

\* Event management

\* Timetable management

\* Library management

\* Book-loan management

\* User account management



\### Teacher



\* Teacher dashboard

\* Assigned classes

\* Student information

\* Attendance management

\* Results management

\* Timetable

\* Profile management

\* Password management



\### Student



\* Student dashboard

\* Personal profile

\* Attendance

\* Examination results

\* Subjects

\* Timetable

\* Fees

\* Notices

\* Events

\* Library and books

\* Password management



\### Parent



\* Parent dashboard

\* Child information

\* Child attendance

\* School notices

\* Profile management

\* Password management



\## System Modules



The portal contains the following major modules:



1\. Admin

2\. Students

3\. Teachers

4\. Parents

5\. Classes

6\. Subjects

7\. Attendance

8\. Results

9\. Timetable

10\. Exams

11\. Fees

12\. Notices

13\. Events

14\. Library

15\. User Management



\## Technologies Used



\### Frontend



\* HTML5

\* CSS3

\* JavaScript

\* Vite



\### Backend and Database



\* Supabase

\* PostgreSQL

\* Supabase Authentication

\* Supabase Storage

\* Supabase Edge Functions



\### Development and Deployment



\* Node.js

\* npm

\* Git

\* GitHub

\* Vercel



\## Database



The system uses PostgreSQL through Supabase.



The database contains 15 main tables:



|  # | Table        | Purpose                              |

| -: | ------------ | ------------------------------------ |

|  1 | `profiles`   | User profile and role information    |

|  2 | `students`   | Student information                  |

|  3 | `teachers`   | Teacher information                  |

|  4 | `parents`    | Parent information                   |

|  5 | `classes`    | Class and section information        |

|  6 | `subjects`   | Subject information                  |

|  7 | `attendance` | Student attendance records           |

|  8 | `results`    | Examination results                  |

|  9 | `timetable`  | Class timetable                      |

| 10 | `books`      | Library books                        |

| 11 | `fees`       | Student fee records                  |

| 12 | `events`     | School events                        |

| 13 | `notices`    | School notices                       |

| 14 | `exams`      | Examination information              |

| 15 | `book\_loans` | Library borrowing and return records |



The database schema is included in the repository as:



`supabase\_schema.sql`



\## Important Database Relationships



The main relationships include:



\* Students → Classes

\* Classes → Teachers

\* Parents → Students

\* Attendance → Students

\* Fees → Students

\* Book Loans → Students

\* Book Loans → Books

\* Teachers → Supabase Authentication

\* Parents → Supabase Authentication

\* Profiles → Supabase Authentication

\* Profiles → Students



\## Authentication and Security



The system uses Supabase Authentication for user authentication and session management.



Security-related features include:



\* User authentication

\* Role-based access

\* Account status checking

\* Secure password management

\* Protected administrative operations

\* Supabase Edge Functions for sensitive operations

\* Database primary and foreign keys

\* Input validation

\* Session-based access control

\* `.gitignore` protection for local environment files



\## Project Structure



```text

sululta-school-portal/

├── admin/

├── attendance/

├── classes/

├── events/

├── exams/

├── fees/

├── library/

├── notices/

├── parent/

├── parents/

├── results/

├── student/

├── students/

├── subjects/

├── teacher/

├── teachers/

├── timetable/

├── src/

├── supabase/

│   └── functions/

├── index.html

├── login.html

├── forgot-password.html

├── reset-password.html

├── package.json

├── package-lock.json

├── vite.config.js

└── supabase\_schema.sql

```



\## Local Development



\### Prerequisites



Install the following before running the project:



\* Node.js

\* npm

\* Git



\### 1. Clone the repository



```bash

git clone https://github.com/adisuurge4-cloud/sululta-school-portal.git

```



\### 2. Open the project



```bash

cd sululta-school-portal

```



\### 3. Install dependencies



```bash

npm install

```



\### 4. Start the development server



```bash

npm run dev

```



Vite will provide a local development address, normally:



```text

http://localhost:5173/

```



\### 5. Build for production



```bash

npm run build

```



\### 6. Preview the production build



```bash

npm run preview

```



\## Deployment



The production frontend is deployed using Vercel.



The backend services are provided by Supabase, including:



\* PostgreSQL database

\* Authentication

\* Storage

\* Edge Functions



The project source code is maintained using Git and GitHub.



\## Testing



The following major areas were tested:



\* User authentication

\* Role-based dashboard redirection

\* Student management

\* Teacher management

\* Parent management

\* Class management

\* Subject management

\* Attendance

\* Results

\* Fees

\* Notices

\* Events

\* Timetable

\* Library

\* User management

\* Profile management

\* Password management

\* Photo display and storage

\* Logout and session handling

\* Production deployment



The completed production application was tested after deployment and the major modules were confirmed to be working.



\## Backup



A final project backup is maintained as:



```text

Sululta-School-Portal-Final.zip

```



The backup contains the project source code and database schema.



\## Future Improvements



Possible future improvements include:



\* Mobile application

\* Online fee payment

\* SMS and email notifications

\* Advanced reports and analytics

\* Improved library management

\* Automated database backups

\* Two-factor authentication

\* Assignment management

\* Online learning resources

\* Additional school services



\## Project Purpose



This project was developed as a Web Programming project to demonstrate practical knowledge of:



\* HTML

\* CSS

\* JavaScript

\* Database design

\* CRUD operations

\* Authentication

\* Role-based access

\* Backend integration

\* Responsive web design

\* Version control

\* Web deployment



\## License



This project was developed for educational purposes as a school management system project.



