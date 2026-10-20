import React from 'react';
import { CreateCollectionUI } from './CreateCollectionUI';
import { Anime } from './CatalogView';

export interface CreateCollectionModalProps {
  animeList: Anime[];
  onClose: () => void;
  onSelectAnime?: (anime: Anime) => void;
}

export const CreateCollectionModal: React.FC<CreateCollectionModalProps> = ({
  animeList,
  onClose,
  onSelectAnime
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-[#080c14]/95 backdrop-blur-xl overflow-y-auto flex items-start justify-center p-2 sm:p-4">
      <div className="w-full">
        <CreateCollectionUI
          animeList={animeList}
          onBack={onClose}
          onSelectAnime={onSelectAnime}
        />
      </div>
    </div>
  );
};
