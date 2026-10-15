import { useState, useEffect } from 'react';
import api from '../api/axios';
import Sidebar from '../components/Sidebar';
import MainArea from '../components/MainArea';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);

  const refreshProjects = async () => {
    try {
      const res = await api.get('/projects/list');
      setProjects(res.data);
      setActiveProject(res.data.find(p => p.is_active) || null);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar projects={projects} onRefresh={refreshProjects} />
      <MainArea activeProject={activeProject} onRefresh={refreshProjects} />
    </div>
  );
}