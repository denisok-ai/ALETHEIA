'use client';

/**
 * Tabs for course detail: Overview | Участники | Learning results | Certificates | Notifications | Группы.
 */
import { useState } from 'react';
import { LayoutDashboard, Users, BarChart3, Award, Bell, Folder } from 'lucide-react';
import { CourseEnrollmentsClient } from './CourseEnrollmentsClient';
import { CourseLearningResults } from './CourseLearningResults';
import { CourseCertificatesBlock } from './CourseCertificatesBlock';
import { CourseNotificationsBlock } from './CourseNotificationsBlock';
import { CourseGroupsBlock } from './CourseGroupsBlock';

const TABS = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'enrolled', label: 'Участники', icon: Users },
  { id: 'results', label: 'Результаты', icon: BarChart3 },
  { id: 'certificates', label: 'Сертификаты курса', icon: Award },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'groups', label: 'Группы', icon: Folder },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function CourseDetailTabs({
  courseId,
  courseTitle,
  children,
}: {
  courseId: string;
  courseTitle: string;
  children: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="space-y-4">
      <div className="border-b border-border">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Разделы курса">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-muted hover:border-border hover:text-dark'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'overview' && children}
      {activeTab === 'enrolled' && (
        <CourseEnrollmentsClient courseId={courseId} courseTitle={courseTitle} />
      )}
      {activeTab === 'results' && (
        <CourseLearningResults courseId={courseId} courseTitle={courseTitle} />
      )}
      {activeTab === 'certificates' && (
        <CourseCertificatesBlock courseId={courseId} courseTitle={courseTitle} />
      )}
      {activeTab === 'notifications' && (
        <CourseNotificationsBlock courseId={courseId} courseTitle={courseTitle} />
      )}
      {activeTab === 'groups' && (
        <CourseGroupsBlock courseId={courseId} />
      )}
    </div>
  );
}
