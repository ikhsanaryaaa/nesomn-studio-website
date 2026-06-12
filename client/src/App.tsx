import { Routes, Route } from 'react-router';

function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-white">
      <h1 className="text-3xl font-semibold tracking-tight">Nesomn Studio</h1>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
