import { useState } from "react";
import { Calculator, FileText, TrendingUp } from "lucide-react";
import { usePageMeta } from "@/hooks/use-page-meta";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CostingStudio } from "./components/CostingStudio";
import { QuotationsList } from "./components/QuotationsList";
import { PaperRatesView } from "./components/PaperRatesView";
import type { CorrugatedBoxInput } from "./api";

export default function CostingPage() {
  usePageMeta("Box Costing", "Corrugated box cost calculation, 3D simulation & client quotations");
  const [activeTab, setActiveTab] = useState<"studio" | "quotations" | "rates">("studio");
  const [clonedBox, setClonedBox] = useState<CorrugatedBoxInput | null>(null);

  const handleCloneToStudio = (box: CorrugatedBoxInput) => {
    setClonedBox(box);
    setActiveTab("studio");
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "studio" | "quotations" | "rates")}>
          <TabsList>
            <TabsTrigger value="studio" className="flex items-center gap-2">
              <Calculator className="size-4" /> Costing Studio
            </TabsTrigger>
            <TabsTrigger value="quotations" className="flex items-center gap-2">
              <FileText className="size-4" /> Quotations & Proposals
            </TabsTrigger>
            <TabsTrigger value="rates" className="flex items-center gap-2">
              <TrendingUp className="size-4" /> Paper Rate Matrix
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "studio" && (
        <CostingStudio
          initialBox={clonedBox}
          onQuotationCreated={() => setActiveTab("quotations")}
        />
      )}

      {activeTab === "quotations" && (
        <QuotationsList
          onCloneToStudio={handleCloneToStudio}
          onCreateNew={() => {
            setClonedBox(null);
            setActiveTab("studio");
          }}
        />
      )}

      {activeTab === "rates" && <PaperRatesView />}
    </div>
  );
}
