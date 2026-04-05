import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import AdminLayout from './components/AdminLayout';
import AdminLogin from './pages/AdminLogin/AdminLogin';
import Dashboard from './pages/Dashboard/Dashboard';
import Topics from './pages/Topics/Topics';
import AddQuestions from './pages/AddQuestions/AddQuestions';
import AIGenerator from './pages/AIGenerator/AIGenerator';
import CreateAssessment from './pages/CreateAssessment/CreateAssessment';
import Assessments from './pages/Assessments/Assessments';
import AssessmentReport from './pages/Reports/Assessmentreport';
import CreateLink from './pages/CreateLink/CreateLink';
import StudentEntry from './pages/StudentEntry/StudentEntry';
import ExamScreen from './pages/ExamScreen/ExamScreen';
import InterviewList from './pages/Interviews/InterviewList';
import InterviewReport from './pages/Interviews/InterviewReport';
import InterviewCandidateLogin from './pages/Interviews/InterviewCandidateLogin';
import InterviewSystemCheck from './pages/Interviews/InterviewSystemCheck';
import InterviewLive from './pages/Interviews/InterviewLive';
import InterviewComplete from './pages/Interviews/InterviewComplete';
import AIInterviewPage from './pages/Interviews/AIInterviewPage';
import IJPList from './pages/IJP/IJPList';
import IJPDetail from './pages/IJP/IJPDetail';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected Admin Routes (Wrapped in Layout) */}
        <Route element={<AdminLayout />}>
          <Route path="/dashboard"                          element={<Dashboard />} />
          <Route path="/topics"                             element={<Topics />} />
          <Route path="/questions/add"                      element={<AddQuestions />} />
          <Route path="/ai-generator"                       element={<AIGenerator />} />
          <Route path="/assessments"                        element={<Assessments />} />
          <Route path="/assessments/create"                 element={<CreateAssessment />} />
          <Route path="/assessments/:assessmentId/report"   element={<AssessmentReport />} />
          <Route path="/links/create"                       element={<CreateLink />} />
          <Route path="/interviews"                         element={<InterviewList />} />
          <Route path="/interviews/reports/:candidateId"    element={<InterviewReport />} />
          <Route path="/ijp"                               element={<IJPList />} />
          <Route path="/ijp/:id"                           element={<IJPDetail />} />
        </Route>

        {/* Student Routes */}
        <Route path="/exam-entry/:linkId"   element={<StudentEntry />} />
        <Route path="/exam/:attemptId"      element={<ExamScreen />} />

        {/* Interview Candidate Routes */}
        <Route path="/ai-interview/c/:token"     element={<AIInterviewPage />} />
        <Route path="/interview/c/:token"        element={<InterviewCandidateLogin />} />
        <Route path="/interview/:linkId"         element={<InterviewCandidateLogin />} />
        <Route path="/interview-system-check/:candidateId" element={<InterviewSystemCheck />} />
        <Route path="/interview-live/:candidateId"         element={<InterviewLive />} />
        <Route path="/interview-complete"                  element={<InterviewComplete />} />
      </Routes>
    </Router>
  );
}

export default App;
