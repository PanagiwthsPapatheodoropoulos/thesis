package com.thesis.smart_resource_planner.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.model.dto.*;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.security.UserPrincipal;
import com.thesis.smart_resource_planner.service.ChatService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.security.Principal;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("ChatController Dedicated Tests")
@SuppressWarnings("removal")
class ChatControllerDedicatedTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChatService chatService;

    private ChatMessageDTO testMessageDTO;
    private ChatMessageCreateDTO createDTO;
    private UserPrincipal employeePrincipal;
    private UUID employeeUserId;
    private UUID messageId;
    private UUID teamId;

    @BeforeEach
    void setUp() {
        messageId = UUID.randomUUID();
        employeeUserId = UUID.randomUUID();
        teamId = UUID.randomUUID();

        testMessageDTO = new ChatMessageDTO();
        testMessageDTO.setId(messageId);
        testMessageDTO.setMessage("Hello World");
        testMessageDTO.setSenderId(employeeUserId);
        testMessageDTO.setIsRead(false);

        createDTO = new ChatMessageCreateDTO();
        createDTO.setMessage("Hello World");
        createDTO.setReceiverId(UUID.randomUUID());

        Company company = new Company();
        company.setId(UUID.randomUUID());

        // Employee User
        User employee = new User();
        employee.setId(employeeUserId);
        employee.setUsername("employeeUser");
        employee.setEmail("emp@example.com");
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(company);
        employeePrincipal = UserPrincipal.create(employee);
    }

    @Test
    @DisplayName("Should send message via REST successfully")
    void testSendMessage_Success() throws Exception {
        when(chatService.sendMessage(any(ChatMessageCreateDTO.class), eq(employeeUserId)))
                .thenReturn(testMessageDTO);

        mockMvc.perform(post("/api/chat/send")
                        .with(user(employeePrincipal))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(createDTO)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Hello World"));

        verify(chatService, times(1)).sendMessage(any(ChatMessageCreateDTO.class), eq(employeeUserId));
    }

    @Test
    @DisplayName("Should retrieve team messages")
    void testGetTeamMessages_Success() throws Exception {
        when(chatService.getTeamMessages(teamId)).thenReturn(Arrays.asList(testMessageDTO));

        mockMvc.perform(get("/api/chat/team/{teamId}", teamId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value("Hello World"));

        verify(chatService, times(1)).getTeamMessages(teamId);
    }

    @Test
    @DisplayName("Should retrieve direct messages")
    void testGetDirectMessages_Success() throws Exception {
        UUID otherUserId = UUID.randomUUID();
        when(chatService.getDirectMessages(employeeUserId, otherUserId)).thenReturn(Arrays.asList(testMessageDTO));

        mockMvc.perform(get("/api/chat/direct/{userId}", otherUserId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value("Hello World"));

        verify(chatService, times(1)).getDirectMessages(employeeUserId, otherUserId);
    }

    @Test
    @DisplayName("Should retrieve available contacts")
    void testGetAvailableContacts_Success() throws Exception {
        UserDTO contact = new UserDTO();
        contact.setId(UUID.randomUUID());
        contact.setUsername("john_doe");

        when(chatService.getAvailableContacts(employeeUserId)).thenReturn(Arrays.asList(contact));

        mockMvc.perform(get("/api/chat/contacts")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("john_doe"));

        verify(chatService, times(1)).getAvailableContacts(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve user conversations")
    void testGetConversations_Success() throws Exception {
        ConversationDTO convo = new ConversationDTO();
        convo.setPartnerId(UUID.randomUUID());
        convo.setPartnerName("Jane Doe");

        when(chatService.getConversations(employeeUserId)).thenReturn(Arrays.asList(convo));

        mockMvc.perform(get("/api/chat/conversations")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].partnerName").value("Jane Doe"));

        verify(chatService, times(1)).getConversations(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve user team chats")
    void testGetUserTeamChats_Success() throws Exception {
        TeamChatDTO teamChat = new TeamChatDTO();
        teamChat.setTeamId(teamId);
        teamChat.setTeamName("Alpha Team");

        when(chatService.getUserTeamChats(employeeUserId)).thenReturn(Arrays.asList(teamChat));

        mockMvc.perform(get("/api/chat/teams")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].teamName").value("Alpha Team"));

        verify(chatService, times(1)).getUserTeamChats(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve unread message count")
    void testGetUnreadCount_Success() throws Exception {
        when(chatService.getUnreadCount(employeeUserId)).thenReturn(10L);

        mockMvc.perform(get("/api/chat/unread/count")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(content().string("10"));

        verify(chatService, times(1)).getUnreadCount(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve unread messages list")
    void testGetUnreadMessages_Success() throws Exception {
        when(chatService.getUnreadMessages(employeeUserId)).thenReturn(Arrays.asList(testMessageDTO));

        mockMvc.perform(get("/api/chat/unread")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].message").value("Hello World"));

        verify(chatService, times(1)).getUnreadMessages(employeeUserId);
    }

    @Test
    @DisplayName("Should mark message as read")
    void testMarkAsRead_Success() throws Exception {
        doNothing().when(chatService).markAsRead(messageId);

        mockMvc.perform(patch("/api/chat/{id}/read", messageId)
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk());

        verify(chatService, times(1)).markAsRead(messageId);
    }

    @Test
    @DisplayName("Should mark all messages as read")
    void testMarkAllAsRead_Success() throws Exception {
        doNothing().when(chatService).markAllAsRead(employeeUserId);

        mockMvc.perform(patch("/api/chat/read-all")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk());

        verify(chatService, times(1)).markAllAsRead(employeeUserId);
    }

    @Test
    @DisplayName("Should retrieve unread counts per contact")
    void testGetUnreadCountPerContact_Success() throws Exception {
        Map<UUID, Long> map = new HashMap<>();
        UUID contactId = UUID.randomUUID();
        map.put(contactId, 3L);

        when(chatService.getUnreadCountPerContact(employeeUserId)).thenReturn(map);

        mockMvc.perform(get("/api/chat/unread/per-contact")
                        .with(user(employeePrincipal)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$." + contactId.toString()).value(3));

        verify(chatService, times(1)).getUnreadCountPerContact(employeeUserId);
    }

    @Test
    @DisplayName("Should invoke WebSocket message mapping handler")
    void testSendWebSocketMessage() {
        ChatController chatController = new ChatController(chatService);
        Principal principal = () -> employeeUserId.toString();
        
        chatController.sendWebSocketMessage(createDTO, principal);
        
        verify(chatService, times(1)).sendMessage(createDTO, employeeUserId);
    }
}
