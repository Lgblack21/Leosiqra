import { FolderOpen } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-slate-50/50">
      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm text-slate-300 flex items-center justify-center mb-5">
        {icon || <FolderOpen size={28} strokeWidth={1.5} />}
      </div>
      <h3 className="text-[15px] font-black text-slate-900 mb-2">{title}</h3>
      <p className="text-xs font-medium text-slate-400 max-w-sm">{description}</p>
    </div>
  );
}
