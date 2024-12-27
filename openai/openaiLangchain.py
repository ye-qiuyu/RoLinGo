from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model="gpt-4o",
    temperature=0,
    max_tokens=None,
    timeout=None,
    max_retries=2,
    api_key="sk-tNuS6BJFPyxQjC0nC3D31a3a23354cC49c790dE532A1B917",
    base_url="https://api.guidaodeng.com/v1",
    # organization="...",
    # other params...
)

messages = [
    (
        "system",
        "You are a helpful translator. Translate the user sentence to French.",
    ),
    ("human", "I love programming."),
]

response = llm.invoke(messages)
print(response)

