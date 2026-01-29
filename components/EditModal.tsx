import React, { useState, useEffect } from 'react';
import { Activity, PRESET_COLORS, PRESET_ICONS } from '../types';
import { Trash2, X, Check } from 'lucide-react';

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (activity: Activity) => void;
  onDelete: (id: string) => void;
  initialActivity?: Partial<Activity>;
  defaultStartTime?: { h: number; m: number };
  otherActivities: Activity[];
}

export const EditModal: React.FC<EditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialActivity,
  defaultStartTime,
  otherActivities,
}) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('08:00');
  const [end, setEnd] = useState('09:00');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);

  useEffect(() => {
    if (isOpen) {
      if (initialActivity && initialActivity.id) {
        // Editing existing
        setTitle(initialActivity.title || '');
        setStart(
          `${String(initialActivity.startHour).padStart(2, '0')}:${String(
            initialActivity.startMinute
          ).padStart(2, '0')}`
        );
        setEnd(
          `${String(initialActivity.endHour).padStart(2, '0')}:${String(
            initialActivity.endMinute
          ).padStart(2, '0')}`
        );
        setColor(initialActivity.color || PRESET_COLORS[0]);
        setIcon(initialActivity.icon || PRESET_ICONS[0]);
      } else {
        // Creating new
        setTitle('');
        if (defaultStartTime) {
          const h = String(defaultStartTime.h).padStart(2, '0');
          const m = String(defaultStartTime.m).padStart(2, '0');
          setStart(`${h}:${m}`);
          // Default 1 hour duration
          const endH = String((defaultStartTime.h + 1) % 24).padStart(2, '0');
          setEnd(`${endH}:${m}`);
        } else {
          setStart('09:00');
          setEnd('10:00');
        }
        setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
        setIcon(PRESET_ICONS[0]);
      }
    }
  }, [isOpen, initialActivity, defaultStartTime]);

  if (!isOpen) return null;

  const getMinutes = (h: number, m: number) => h * 60 + m;

  const checkOverlap = (newStartH: number, newStartM: number, newEndH: number, newEndM: number) => {
    // Convert to linear minutes (0-1440)
    // Handle wrap simply by checking 24h ranges if needed, but for now assuming most events are within day or wrap once.
    // If wrap, we treat it as two segments or one long segment?
    // Let's use simple minute comparison, handling wrap.

    // Helper to check collision between two ranges [s1, e1] and [s2, e2] (exclusive end?)
    // In this app, visually 9:00-10:00 and 10:00-11:00 are touching, which is fine.
    // So overlap means (s1 < e2) && (s2 < e1).

    // Complex part: wrapping (e.g. 23:00 - 02:00)
    // Normalize to 0-1440. If wrapped, treat as two intervals: [start, 1440] and [0, end].

    const getIntervals = (sH: number, sM: number, eH: number, eM: number) => {
      const s = getMinutes(sH, sM);
      const e = getMinutes(eH, eM);
      if (e < s) {
        return [[s, 1440], [0, e]];
      }
      return [[s, e]];
    }

    const newIntervals = getIntervals(newStartH, newStartM, newEndH, newEndM);

    for (const act of otherActivities) {
      // Skip self if id matches (should be handled by parent filtering passed prop, but good safety)
      if (initialActivity?.id === act.id) continue;

      const existingIntervals = getIntervals(act.startHour, act.startMinute, act.endHour, act.endMinute);

      for (const newInt of newIntervals) {
        for (const existInt of existingIntervals) {
          // Check Overlap: (StartA < EndB) && (EndA > StartB)
          if (newInt[0] < existInt[1] && newInt[1] > existInt[0]) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const handleSave = () => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    // Validate overlap
    if (checkOverlap(startH, startM, endH, endM)) {
      alert("ほかのよていとかさなっているよ！じかんをかえてね。");
      return;
    }

    onSave({
      id: initialActivity?.id || crypto.randomUUID(),
      title: title || '新しいよてい',
      startHour: startH,
      startMinute: startM,
      endHour: endH,
      endMinute: endM,
      color,
      icon,
    });
    onClose();
  };

  const handleDelete = () => {
    if (initialActivity?.id) {
      onDelete(initialActivity.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">
              {initialActivity?.id ? 'よていをへんこう' : 'よていをついか'}
            </h2>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
              <X className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">なにする？</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: あさごはん"
                className="w-full text-xl font-bold p-3 bg-gray-50 rounded-xl border-2 border-transparent focus:border-blue-400 focus:outline-none"
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">はじまり</label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-full text-lg font-bold p-3 bg-gray-50 rounded-xl border-2 border-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-2">おわり</label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-full text-lg font-bold p-3 bg-gray-50 rounded-xl border-2 border-gray-100"
                />
              </div>
            </div>

            {/* Icons */}
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">アイコン</label>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {PRESET_ICONS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setIcon(i)}
                    className={`flex-shrink-0 w-12 h-12 text-2xl flex items-center justify-center rounded-xl border-2 transition-all ${icon === i ? 'border-blue-500 bg-blue-50 scale-110' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="block text-sm font-bold text-gray-500 mb-2">いろ</label>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`flex-shrink-0 w-10 h-10 rounded-full border-4 transition-all ${color === c ? 'border-gray-300 scale-110 shadow-md' : 'border-transparent'
                      }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex gap-3">
          {initialActivity?.id && (
            <button
              onClick={handleDelete}
              className="flex-1 py-3 rounded-xl bg-red-100 text-red-600 font-bold flex items-center justify-center gap-2 hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              けす
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-[2] py-3 rounded-xl bg-blue-500 text-white font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors shadow-lg shadow-blue-200"
          >
            <Check className="w-5 h-5" />
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
