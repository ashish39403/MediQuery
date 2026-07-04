from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
import os

load_dotenv()

llm = ChatOpenAI(
    model="anthropic/claude-sonnet-4.5",
    base_url="https://api.aicredits.in/v1",
    api_key=os.getenv("OPENAI_API_KEY"),
)

embeddings = OpenAIEmbeddings(api_key=os.getenv("OPENAI_API_KEY") , base_url=os.getenv("OPENAI_BASE_URL"), model=os.getenv("EMBEDDING_MODEL"))

texts = [
    "AICredits is a unified LLM gateway for India.",
    "Credits are billed in INR and valid for 1 year.",
    "The API is OpenAI-compatible — just change the base URL.",
]
vectorstore = FAISS.from_texts(texts, embeddings)
retriever = vectorstore.as_retriever()

prompt = ChatPromptTemplate.from_template("""Answer based on the context:

Context: {context}

Question: {question}""")

def format_docs(docs):
    return "\n\n".join(doc.page_content for doc in docs)

rag_chain = (
    {"context": retriever | format_docs, "question": RunnablePassthrough()}
    | prompt
    | llm
    | StrOutputParser()
)

answer = rag_chain.invoke("How long are credits valid?")
print(answer)