import Dashboard from './Dashboard';
import IndividualDashboard from './IndividualDashboard';
import { isIndividualSession } from '../../utils/auth';

export default function SessionDashboard() {
  return isIndividualSession() ? <IndividualDashboard /> : <Dashboard />;
}
