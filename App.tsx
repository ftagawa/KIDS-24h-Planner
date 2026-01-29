import React, { useState, useEffect } from 'react';
import { ScheduleCircle } from './components/ScheduleCircle';
import { EditModal } from './components/EditModal';
import { Activity } from './types';
import { Sparkles, Plus } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const App: React.FC = () => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Partial<Activity> | undefined>(undefined);
  const [clickedTime, setClickedTime] = useState<{ h: number; m: number } | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('kids-planner-activities');
    if (saved) {
      setActivities(JSON.parse(saved));
    } else {
      // Sample initial data
      setActivities([
        { id: '1', title: 'ねる', startHour: 22, startMinute: 0, endHour: 7, endMinute: 0, color: '#3b82f6', icon: '😴' },
        { id: '2', title: 'がっこう', startHour: 8, startMinute: 30, endHour: 15, endMinute: 0, color: '#facc15', icon: '🏫' },
      ]);
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('kids-planner-activities', JSON.stringify(activities));
  }, [activities]);

  const handleTimeClick = (h: number, m: number) => {
    // Check if clicked existing activity is handled by SVG click handler.
    // This is for empty spaces.
    setSelectedActivity(undefined);
    setClickedTime({ h, m });
    setIsModalOpen(true);
  };

  const handleActivityClick = (activity: Activity) => {
    setSelectedActivity(activity);
    setClickedTime(undefined);
    setIsModalOpen(true);
  };

  const handleSaveActivity = (activity: Activity) => {
    setActivities((prev) => {
      // Remove existing if editing
      const filtered = prev.filter((a) => a.id !== activity.id);
      return [...filtered, activity];
    });
  };

  const handleDeleteActivity = (id: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id));
  };

  const generateSchedule = async () => {
    if (!process.env.API_KEY) {
      alert("API Key not found. Please set existing activities manually.");
      return;
    }
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a JSON array of daily activities for a 7-year-old child on a school day. 
            The output must be a valid JSON array of objects. 
            Each object must strictly have: 
            "title" (string, in Japanese simple hiragana/katakana if possible), 
            "startHour" (number 0-23), 
            "startMinute" (number 0-59), 
            "endHour" (number 0-23), 
            "endMinute" (number 0-59), 
            "color" (hex string, bright colors), 
            "icon" (single emoji string).
            Example: [{"title": "あさごはん", "startHour": 7, "startMinute": 0, "endHour": 7, "endMinute": 30, "color": "#FF6B6B", "icon": "🍳"}]
            Do not include markdown formatting or backticks. Return RAW JSON only.`,
      });

      let jsonStr = response.text.trim();
      // Cleanup if markdown is returned despite prompt
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json/, '').replace(/```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```/, '').replace(/```$/, '');
      }

      const newActivities = JSON.parse(jsonStr);
      // Add IDs
      const activitiesWithIds = newActivities.map((a: any) => ({
        ...a,
        id: crypto.randomUUID()
      }));
      setActivities(activitiesWithIds);

    } catch (error) {
      console.error("AI Generation failed", error);
      alert("AIによるスケジュールの作成に失敗しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center pb-20">
      {/* Header */}
      <header className="w-full bg-white shadow-sm p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-2xl font-black text-sky-600 tracking-tight">
          🕒 1にちのよてい
        </h1>
        {process.env.API_KEY && (
          <button
            onClick={generateSchedule}
            disabled={isGenerating}
            className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-4 py-2 rounded-full font-bold text-sm shadow-md flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {isGenerating ? 'かんがえ中...' : <><Sparkles size={16} /> AIにおまかせ</>}
          </button>
        )}
      </header>

      {/* Main Circle */}
      <main className="flex-1 w-full max-w-2xl px-4 flex flex-col justify-center">
        <div className="bg-white rounded-[3rem] shadow-xl p-4 my-6">
          <ScheduleCircle
            activities={activities}
            onTimeClick={handleTimeClick}
            onActivityClick={handleActivityClick}
          />
        </div>

        <div className="text-center text-gray-500 font-bold mb-4">
          えんをタップして よていをつくろう！
        </div>

        {/* Legend / List View for Accessiblity/Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
          {activities
            .sort((a, b) => (a.startHour * 60 + a.startMinute) - (b.startHour * 60 + b.startMinute))
            .map(act => (
              <div
                key={act.id}
                onClick={() => handleActivityClick(act)}
                className="bg-white p-3 rounded-2xl shadow-sm flex items-center gap-3 cursor-pointer hover:bg-sky-50 transition-colors border border-transparent hover:border-sky-200"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-inner" style={{ backgroundColor: act.color + '40' }}>
                  {act.icon}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-800">{act.title}</div>
                  <div className="text-xs text-gray-500 font-bold">
                    {String(act.startHour).padStart(2, '0')}:{String(act.startMinute).padStart(2, '0')} - {String(act.endHour).padStart(2, '0')}:{String(act.endMinute).padStart(2, '0')}
                  </div>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: act.color }} />
              </div>
            ))}
        </div>
      </main>

      {/* FAB for manual add */}
      <button
        onClick={() => {
          setSelectedActivity(undefined);
          setClickedTime(undefined);
          setIsModalOpen(true);
        }}
        className="fixed bottom-6 right-6 w-16 h-16 bg-sky-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-sky-600 hover:scale-105 transition-all z-20"
      >
        <Plus size={32} strokeWidth={3} />
      </button>

      <EditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveActivity}
        onDelete={handleDeleteActivity}
        initialActivity={selectedActivity}
        defaultStartTime={clickedTime}
        otherActivities={activities.filter(a => a.id !== selectedActivity?.id)}
      />
    </div>
  );
};

export default App;
