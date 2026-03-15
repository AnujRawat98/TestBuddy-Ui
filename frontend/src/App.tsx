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
import CreateLink from './pages/CreateLink/CreateLink';
import StudentEntry from './pages/StudentEntry/StudentEntry';
import ExamScreen from './pages/ExamScreen/ExamScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<AdminLogin />} />

        {/* Protected Admin Routes (Wrapped in Layout) */}
        <Route element={<AdminLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/topics" element={<Topics />} />
          <Route path="/questions/add" element={<AddQuestions />} />
          <Route path="/ai-generator" element={<AIGenerator />} />
          <Route path="/assessments" element={<Assessments />} />
          <Route path="/assessments/create" element={<CreateAssessment />} />
          <Route path="/links/create" element={<CreateLink />} />
        </Route>

        {/* Student Routes */}
        <Route path="/exam-entry/:linkId" element={<StudentEntry />} />
        <Route path="/exam/:attemptId" element={<ExamScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
