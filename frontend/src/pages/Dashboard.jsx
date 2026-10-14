import Sidebar from '../components/Sidebar';
import MainArea from '../components/MainArea';

export default function Dashboard() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar />
      <MainArea />
    </div>
  );
}