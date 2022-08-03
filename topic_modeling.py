import logging
from os.path import exists
import re
from typing import List, Tuple

from datasets import load_dataset
from gensim.parsing.preprocessing import strip_tags
from gensim.utils import simple_preprocess
import numpy as np
import pandas as pd
from top2vec import Top2Vec

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
sh = logging.StreamHandler()
sh.setFormatter(
    logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s"))
logger.addHandler(sh)


class WikipediaTopicModel:

  __slots__ = ("_df", "_topic_model")

  def __init__(self,
               num_documents_trained: int,
               embedding_model: str = "doc2vec") -> None:
    # Create pandas DataFrame
    self._df = WikipediaTopicModel._create_df(
        num_documents_trained,
        df_pickle_location=f"data/data_frame_{num_documents_trained}.pkl")

    # Create Top2Vec topic model
    self._topic_model = WikipediaTopicModel._create_topic_model(
        self._df["text"].tolist(),
        embedding_model,
        saved_topic_model_location=f"models/top2vec_{embedding_model}_"
        f"{num_documents_trained}")

  @staticmethod
  def _create_df(
      num_documents: int,
      df_pickle_location: str = "data/data_frame.pkl") -> pd.DataFrame:

    def trim_document_to_punctuation(
        document: str, num_words: int,
        punctuation: List[str] = list(".!?")) -> str:

      def contains_any(document: str, characters: List[str]) -> bool:
        contains = []
        for character in characters:
          contains.append(character in document)
        return any(contains)

      try:
        split_document = document.replace("\n", " \n ").split(" ")
        pointer_up = num_words - 1
        pointer_down = num_words - 1
        while not contains_any(split_document[pointer_up], punctuation):
          pointer_up += 1
        while not contains_any(split_document[pointer_up], punctuation):
          pointer_down -= 1
        deviation_up = pointer_up - num_words
        deviation_down = num_words - pointer_down
        trimmed_document = ""
        if deviation_up > deviation_down:
          trimmed_document = " ".join(split_document[:pointer_down + 1])
        else:
          trimmed_document = " ".join(split_document[:pointer_up + 1])
        return trimmed_document
      except IndexError:
        return document

    if exists(df_pickle_location):
      logger.info("Pandas DataFrame found")
      df = pd.read_pickle(df_pickle_location)
      return df
    # Create pandas DataFrame
    logger.info("Creating Pandas DataFrame")
    df = pd.DataFrame(
        # Use the first num_documents documents. Random samples are too memory 
        # expensive
        load_dataset("wikipedia", "20220301.en")["train"][:num_documents])
    # Trim the documents
    logger.info("Trimming documents")
    df["text"] = df["text"].apply(
        lambda document: trim_document_to_punctuation(document, 50))
    # Save the DataFrame
    logger.info("Saving pandas DataFrame")
    df.to_pickle(df_pickle_location)
    return df

  @staticmethod
  def _create_topic_model(
      documents: List[str],
      embedding_model: str,
      saved_topic_model_location: str = "models/top2vec_model") -> Top2Vec:
    # Check if saved topic model exists
    if exists(saved_topic_model_location):
      logger.info("Top2Vec saved topic model found")
      topic_model = Top2Vec.load(saved_topic_model_location)
      return topic_model
    # Create Top2Vec model
    logger.info("Creating Top2Vec topic model")
    topic_model = Top2Vec(documents, embedding_model=embedding_model)
    # Save model
    logger.info("Saving Top2Vec topic model")
    topic_model.save(saved_topic_model_location)
    return topic_model

  def get_cos_similarity(self, document_1: str, document_2: str) -> float:
    """Gets the cosine similarity for 2 documents."""
    # Get the embeddings for each document
    try:
      # Try to use _embed_query, which only works if topic model's embedding 
      # model is not doc2vec
      embeddings_1 = self._topic_model._embed_query(document_1)
      embeddings_2 = self._topic_model._embed_query(document_2)
    except AttributeError:
      # Tokenize each document
      tokenized_document_1 = simple_preprocess(
          strip_tags(document_1), deacc=True)
      tokenized_document_2 = simple_preprocess(
          strip_tags(document_2), deacc=True)
      # Calculate the embeddings for each document
      embeddings_1 = self._topic_model.model.infer_vector(
          doc_words=tokenized_document_1,
          alpha=0.025,
          min_alpha=0.01,
          epochs=100)
      embeddings_2 = self._topic_model.model.infer_vector(
          doc_words=tokenized_document_2,
          alpha=0.025,
          min_alpha=0.01,
          epochs=100)
    # Calculate the cosine similarity with the document embeddings
    cos_similarity = np.dot(embeddings_1, embeddings_2) / (
        np.linalg.norm(embeddings_1) * np.linalg.norm(embeddings_2))
    return cos_similarity

  def get_topics(self, document: str, num_topics: int = 5) -> List[str]:
    """Gets the closest topics for a given document."""
    if num_topics > 50:
      raise ValueError("Number of topics must be less than or equal to 50")
    topics = list(
        self._topic_model.query_topics(document, 50)[0][0][:num_topics])
    return topics

  def topics_are_similar(self, topic_words_1: List[str],
                         topic_words_2: List[str], threshold: float) -> bool:
    """Returns True if the average cosine distance between the pairs of topics 
    in topic_words1 and topic_words2 is greater than a threshold."""
    if len(topic_words_1) != len(topic_words_2):
      raise ValueError("Both lists of topic words do not have the same length")
    # Calculate cosine similarities for each pair of topic words
    cos_similarities = []
    for i in range(len(topic_words_1)):
      cos_similarities.append(
          self.get_cos_similarity(topic_words_1[i], topic_words_2[i]))
    # Calculate the average cosine similarity
    cos_similarity_avg = sum(cos_similarities) / len(cos_similarities)
    # The topic words are similar if the average cosine similarity exceeds 
    # threshold
    return bool(cos_similarity_avg > threshold), cos_similarity_avg

  def get_topic_clusters(self,
                         document: str,
                         threshold: float = 0.22) -> List[Tuple[str, str]]:
    """Gets a dictionary which maps different topics in the document to their 
    corresponding parts in the document."""
    clusters_to_topics: List[Tuple[str, str]] = []
    # Split the document into lines
    lines = re.split("\.|\n", document)
    lines = [line.strip() + "." for line in lines if line != ""]
    # Create clusters
    cluster = ""
    for line in lines:
      # Get the topics for each line and the current cluster, and whether
      # or not the topics are similar
      topics_1 = self.get_topics(cluster)
      topics_2 = self.get_topics(line)
      topics_are_similar_, _ = self.topics_are_similar(topics_1, topics_2,
                                                       threshold)
      # Modify the current cluster
      if not topics_are_similar_:
        clusters_to_topics.append(
            (cluster, ", ".join(self.get_topics(cluster))))
        cluster = line + " "
      else:
        cluster += line + " "
      if line == lines[-1]:
        clusters_to_topics.append(
            (cluster, ", ".join(self.get_topics(cluster))))
    clusters_to_topics = [(cluster, topics)
                          for cluster, topics in clusters_to_topics
                          if cluster != ""]
    return clusters_to_topics
