export type MockSummaryCard = {
  label: string;
  value: string;
  description: string;
};

export type MockSectionItem = {
  title: string;
  description: string;
  meta?: string;
};

export type MockFeaturePageData = {
  title: string;
  description: string;
  summaryCards: MockSummaryCard[];
  sections: Array<{
    title: string;
    description: string;
    items: MockSectionItem[];
  }>;
};
