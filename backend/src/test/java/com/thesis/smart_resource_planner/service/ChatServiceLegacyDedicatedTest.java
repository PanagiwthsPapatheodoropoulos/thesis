package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.enums.UserRole;
import com.thesis.smart_resource_planner.exception.BadRequestException;
import com.thesis.smart_resource_planner.model.dto.ChatMessageCreateDTO;
import com.thesis.smart_resource_planner.model.dto.ChatMessageDTO;
import com.thesis.smart_resource_planner.model.dto.UserDTO;
import com.thesis.smart_resource_planner.model.entity.ChatMessage;
import com.thesis.smart_resource_planner.model.entity.Company;
import com.thesis.smart_resource_planner.model.entity.Team;
import com.thesis.smart_resource_planner.model.entity.User;
import com.thesis.smart_resource_planner.repository.ChatMessageRepository;
import com.thesis.smart_resource_planner.repository.EmployeeRepository;
import com.thesis.smart_resource_planner.repository.TeamRepository;
import com.thesis.smart_resource_planner.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.modelmapper.ModelMapper;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatService Tests")
class ChatServiceLegacyDedicatedTest {

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private TeamRepository teamRepository;

    @Mock
    private EmployeeRepository employeeRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ModelMapper modelMapper;

    @Mock
    private WebSocketBroadcastService broadcastService;

    @InjectMocks
    private ChatService chatService;

    private UUID senderId;
    private UUID receiverId;
    private User sender;
    private User receiver;

    @BeforeEach
    void setUp() {
        senderId = UUID.randomUUID();
        receiverId = UUID.randomUUID();

        Company company = new Company();
        company.setId(UUID.randomUUID());

        sender = new User();
        sender.setId(senderId);
        sender.setUsername("sender");
        sender.setEmail("sender@example.com");
        sender.setPasswordHash("x");
        sender.setRole(UserRole.ADMIN);
        sender.setCompany(company);

        receiver = new User();
        receiver.setId(receiverId);
        receiver.setUsername("receiver");
        receiver.setEmail("receiver@example.com");
        receiver.setPasswordHash("x");
        receiver.setRole(UserRole.EMPLOYEE);
        receiver.setCompany(company);
    }

    @Test
    @DisplayName("sendMessage: direct message sends to receiver and echoes to sender")
    void sendMessage_direct_success() {
        ChatMessageCreateDTO createDTO = new ChatMessageCreateDTO();
        createDTO.setReceiverId(receiverId);
        createDTO.setMessage("hello");

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findById(receiverId)).thenReturn(Optional.of(receiver));

        ChatMessage saved = ChatMessage.builder()
                .id(UUID.randomUUID())
                .sender(sender)
                .receiver(receiver)
                .message("hello")
                .isRead(false)
                .build();
        when(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).thenReturn(saved);

        when(modelMapper.map(eq(saved), eq(ChatMessageDTO.class))).thenReturn(new ChatMessageDTO());
        when(employeeRepository.findByUserId(any())).thenReturn(Optional.empty());

        ChatMessageDTO result = chatService.sendMessage(createDTO, senderId);

        assertNotNull(result);
        verify(messagingTemplate, times(2)).convertAndSendToUser(anyString(), eq("/queue/messages"), any());
    }

    @Test
    @DisplayName("sendMessage: throws when neither receiverId nor teamId provided")
    void sendMessage_requiresReceiverOrTeam() {
        ChatMessageCreateDTO createDTO = new ChatMessageCreateDTO();
        createDTO.setMessage("hello");

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        assertThrows(BadRequestException.class, () -> chatService.sendMessage(createDTO, senderId));
    }

    @Test
    @DisplayName("markAsRead: marks unread message and broadcasts read receipt")
    void markAsRead_success() {
        UUID messageId = UUID.randomUUID();
        ChatMessage msg = ChatMessage.builder()
                .id(messageId)
                .sender(sender)
                .receiver(receiver)
                .message("hi")
                .isRead(false)
                .build();

        when(chatMessageRepository.findById(messageId)).thenReturn(Optional.of(msg));
        when(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).thenReturn(msg);

        chatService.markAsRead(messageId);

        assertTrue(msg.getIsRead());
        verify(broadcastService, times(1)).broadcastMessageRead(eq(senderId), anyMap());
    }

    @Test
    @DisplayName("markAsRead: no-op when already read")
    void markAsRead_alreadyRead_noBroadcast() {
        UUID messageId = UUID.randomUUID();
        ChatMessage msg = ChatMessage.builder()
                .id(messageId)
                .sender(sender)
                .receiver(receiver)
                .message("hi")
                .isRead(true)
                .build();

        when(chatMessageRepository.findById(messageId)).thenReturn(Optional.of(msg));
        chatService.markAsRead(messageId);

        verify(chatMessageRepository, never()).saveAndFlush(any(ChatMessage.class));
        verify(broadcastService, never()).broadcastMessageRead(any(UUID.class), anyMap());
    }

    @Test
    @DisplayName("markAllAsRead marks unread list and broadcasts update")
    void markAllAsRead_success() {
        ChatMessage unread = ChatMessage.builder()
                .id(UUID.randomUUID())
                .sender(sender)
                .receiver(receiver)
                .message("unread")
                .isRead(false)
                .build();
        when(chatMessageRepository.findUnreadByReceiverId(receiverId)).thenReturn(List.of(unread));

        chatService.markAllAsRead(receiverId);

        assertTrue(unread.getIsRead());
        verify(chatMessageRepository).saveAllAndFlush(anyList());
        verify(messagingTemplate).convertAndSend(contains(receiverId.toString()), anyMap());
    }

    @Test
    @DisplayName("getAvailableContacts: admin sees managers and employees only")
    void getAvailableContacts_adminBranch() {
        UUID managerId = UUID.randomUUID();
        UUID employeeId = UUID.randomUUID();
        UUID userRoleId = UUID.randomUUID();

        User manager = new User();
        manager.setId(managerId);
        manager.setUsername("manager");
        manager.setRole(UserRole.MANAGER);
        manager.setCompany(sender.getCompany());

        User employee = new User();
        employee.setId(employeeId);
        employee.setUsername("employee");
        employee.setRole(UserRole.EMPLOYEE);
        employee.setCompany(sender.getCompany());

        User basic = new User();
        basic.setId(userRoleId);
        basic.setUsername("basic");
        basic.setRole(UserRole.USER);
        basic.setCompany(sender.getCompany());

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(userRepository.findByCompanyId(sender.getCompany().getId())).thenReturn(List.of(manager, employee, basic));
        when(userRepository.findById(managerId)).thenReturn(Optional.of(manager));
        when(userRepository.findById(employeeId)).thenReturn(Optional.of(employee));
        when(modelMapper.map(eq(manager), eq(UserDTO.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            UserDTO dto = new UserDTO();
            dto.setId(u.getId());
            dto.setUsername(u.getUsername());
            return dto;
        });
        when(modelMapper.map(eq(employee), eq(UserDTO.class))).thenAnswer(i -> {
            User u = i.getArgument(0);
            UserDTO dto = new UserDTO();
            dto.setId(u.getId());
            dto.setUsername(u.getUsername());
            return dto;
        });

        var contacts = chatService.getAvailableContacts(senderId);
        assertEquals(2, contacts.size());
    }

    @Test
    @DisplayName("getUserTeamChats: admin receives teams summary list")
    void getUserTeamChats_adminBranch() {
        Team team = new Team();
        team.setId(UUID.randomUUID());
        team.setName("Team A");
        team.setCompany(sender.getCompany());

        when(userRepository.findById(senderId)).thenReturn(Optional.of(sender));
        when(teamRepository.findByCompanyId(sender.getCompany().getId())).thenReturn(List.of(team));
        when(chatMessageRepository.findByTeamIdOrderByCreatedAtDesc(team.getId())).thenReturn(List.of());
        when(userRepository.countByTeamId(team.getId())).thenReturn(3L);

        var chats = chatService.getUserTeamChats(senderId);
        assertEquals(1, chats.size());
        assertEquals("Team A", chats.get(0).getTeamName());
    }
}
